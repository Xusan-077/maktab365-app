// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type { OfflineBook } from "@/lib/offline/pdf-cache";

const cache = vi.hoisted(() => ({
  isSavedOffline: vi.fn(),
  savePdfOffline: vi.fn(),
  removeOffline: vi.fn(),
  clearOffline: vi.fn(),
  readRegistry: vi.fn(),
  storageEstimate: vi.fn(),
  isOfflineSupported: vi.fn(() => true),
}));
const api = vi.hoisted(() => ({ fileUrl: vi.fn() }));

vi.mock("@/lib/offline/pdf-cache", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/offline/pdf-cache")>("@/lib/offline/pdf-cache");
  return { ...actual, ...cache };
});
vi.mock("@/lib/pdf-books/api", () => ({ getPdfBooksApi: () => api, PDF_PAGE_SIZE: 24 }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { OfflineButton } from "./OfflineButton";
import { OfflineManager } from "./OfflineManager";

const t = uz.offline;
const book = {
  id: "b1",
  slug: "9-sinf-algebra",
  grade: 9,
  title: { uz: "Algebra" },
  sizeBytes: 10 * 1024 * 1024,
};

function renderWith(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  cache.isOfflineSupported.mockReturnValue(true);
  cache.isSavedOffline.mockResolvedValue(false);
  cache.storageEstimate.mockResolvedValue({ usage: 0, quota: 1e12 });
  api.fileUrl.mockResolvedValue({ url: "https://r2.test/b1.pdf", expires_in: 600 });
  cache.savePdfOffline.mockResolvedValue({});
  cache.removeOffline.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("OfflineButton", () => {
  it("kichik fayl: bosilsa darrov saqlaydi va «saqlangan» holatga o'tadi", async () => {
    renderWith(<OfflineButton book={book} />);
    fireEvent.click(await screen.findByTestId("offline-save"));

    await waitFor(() => expect(cache.savePdfOffline).toHaveBeenCalledTimes(1));
    const call = cache.savePdfOffline.mock.calls[0][0];
    expect(call.url).toBe("https://r2.test/b1.pdf");
    expect(call.book).toEqual({
      id: "b1",
      slug: "9-sinf-algebra",
      grade: 9,
      title: { uz: "Algebra" },
    });
    expect(await screen.findByTestId("offline-saved")).toBeTruthy();
  });

  it("katta fayl yoki joy yetmasligida avval ogohlantiradi va tasdiq kutadi", async () => {
    renderWith(<OfflineButton book={{ ...book, sizeBytes: 80 * 1024 * 1024 }} />);
    fireEvent.click(await screen.findByTestId("offline-save"));

    expect((await screen.findByTestId("offline-warning")).textContent).toContain("80 MB");
    expect(cache.savePdfOffline).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("offline-confirm"));
    await waitFor(() => expect(cache.savePdfOffline).toHaveBeenCalledTimes(1));
  });

  it("saqlangan kitobda «O'chirish» xotirani tozalaydi", async () => {
    cache.isSavedOffline.mockResolvedValue(true);
    renderWith(<OfflineButton book={book} />);
    expect(await screen.findByTestId("offline-saved")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.remove }));
    await waitFor(() => expect(cache.removeOffline).toHaveBeenCalledWith("b1"));
    expect(await screen.findByTestId("offline-save")).toBeTruthy();
  });

  it("xatoda xabar va qayta urinish tugmasi", async () => {
    cache.savePdfOffline.mockRejectedValueOnce(new Error("network"));
    renderWith(<OfflineButton book={book} />);
    fireEvent.click(await screen.findByTestId("offline-save"));
    expect(await screen.findByText(t.error)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.retry }));
    await waitFor(() => expect(cache.savePdfOffline).toHaveBeenCalledTimes(2));
  });

  it("brauzer qo'llamasa hech narsa ko'rsatilmaydi", async () => {
    cache.isOfflineSupported.mockReturnValue(false);
    renderWith(<OfflineButton book={book} />);
    await waitFor(() => expect(cache.isSavedOffline).toHaveBeenCalled());
    expect(screen.queryByTestId("offline-control")).toBeNull();
  });
});

describe("OfflineManager", () => {
  const saved = (id: string, size: number): OfflineBook => ({
    id,
    slug: `9-sinf-${id}`,
    grade: 9,
    title: { uz: `Kitob ${id}` },
    sizeBytes: size,
    savedAt: "2026-10-23T00:00:00Z",
  });

  it("bo'sh holat", async () => {
    cache.readRegistry.mockReturnValue([]);
    renderWith(<OfflineManager />);
    expect(await screen.findByText(t.empty)).toBeTruthy();
  });

  it("ro'yxat, umumiy hajm va bittasini o'chirish", async () => {
    cache.readRegistry.mockReturnValue([saved("a", 1024 * 1024), saved("b", 2 * 1024 * 1024)]);
    renderWith(<OfflineManager />);

    const usage = await screen.findByTestId("offline-usage");
    expect(usage.textContent).toContain("2 ta kitob");
    expect(usage.textContent).toContain("3 MB");
    const link = screen.getByRole("link", { name: "Kitob a" });
    expect(link.getAttribute("href")).toBe("/darsliklar/9/9-sinf-a/oqish");

    cache.readRegistry.mockReturnValue([saved("b", 2 * 1024 * 1024)]);
    fireEvent.click(screen.getByRole("button", { name: /Kitob a ni oflayn xotiradan/ }));
    await waitFor(() => expect(cache.removeOffline).toHaveBeenCalledWith("a"));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Kitob a" })).toBeNull());
  });

  it("«Hammasini o'chirish»", async () => {
    cache.readRegistry.mockReturnValue([saved("a", 10)]);
    cache.clearOffline.mockResolvedValue(undefined);
    renderWith(<OfflineManager />);
    fireEvent.click(await screen.findByRole("button", { name: t.clearAll }));
    await waitFor(() => expect(cache.clearOffline).toHaveBeenCalled());
  });
});
