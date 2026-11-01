// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

const progress = vi.hoisted(() => ({
  map: {} as Record<string, { page: number; status: null }>,
}));
vi.mock("@/hooks/usePdfProgressMap", async () => {
  const { mergeReadStatus } = await import("@/lib/pdf/progress");
  return {
    usePdfProgressMap: () => progress.map,
    isBookRead: (entry: { page: number; status: null } | undefined, total: number) =>
      entry !== undefined && mergeReadStatus(entry.status, entry.page, total) === "read",
  };
});
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BookActions, telegramShareUrl } from "./BookActions";

const t = uz.pdfBooks.page;
const props = {
  id: "b1",
  grade: 9,
  slug: "9-sinf-algebra",
  title: "Algebra",
  pageCount: 200,
};

function setup(over: Partial<typeof props> = {}) {
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <BookActions {...props} {...over} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  progress.map = {};
});
afterEach(cleanup);

describe("BookActions", () => {
  it("«Onlayn o'qish» o'qish oynasiga olib boradi", () => {
    setup();
    const link = screen.getByRole("link", { name: t.read });
    expect(link.getAttribute("href")).toBe("/darsliklar/9/9-sinf-algebra/oqish");
  });

  it("o'qishni boshlagan foydalanuvchiga «N-betdan davom ettirish» ko'rinadi", () => {
    progress.map = { b1: { page: 45, status: null } };
    setup();
    const link = screen.getByRole("link", { name: "45-betdan davom ettirish" });
    expect(link.getAttribute("href")).toBe("/darsliklar/9/9-sinf-algebra/oqish?page=45");
  });

  it("oxirgi betga yetgan yoki 1-betdagi kitobda oddiy «Onlayn o'qish»", () => {
    progress.map = { b1: { page: 200, status: null } };
    setup();
    expect(screen.getByRole("link", { name: t.read })).toBeTruthy();
    cleanup();
    progress.map = { b1: { page: 1, status: null } };
    setup();
    expect(screen.getByRole("link", { name: t.read })).toBeTruthy();
  });

  it("foydalanuvchi interfeysida yuklab olish tugmasi ham, havolasi ham yo'q", () => {
    setup();
    expect(screen.queryByRole("button", { name: /yuklab olish/i })).toBeNull();
    expect(screen.queryByText(/yuklab olish/i)).toBeNull();
    expect(document.querySelector("a[download]")).toBeNull();
    expect(screen.getByRole("link", { name: t.read })).toBeTruthy();
  });

  it("ulashish menyusi: Telegram havolasi va nusxalash", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    setup();
    fireEvent.click(screen.getByRole("button", { name: t.share }));
    const telegram = screen.getByRole("menuitem", { name: t.shareTelegram });
    expect(telegram.getAttribute("href")).toContain("https://t.me/share/url?url=");
    expect(telegram.getAttribute("href")).toContain(encodeURIComponent("Algebra"));

    fireEvent.click(screen.getByRole("menuitem", { name: t.copyLink }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(await screen.findByText(t.copied)).toBeTruthy();
  });
});

describe("telegramShareUrl", () => {
  it("url va matnni kodlaydi", () => {
    expect(telegramShareUrl("https://a.b/c?d=1", "A & B")).toBe(
      "https://t.me/share/url?url=https%3A%2F%2Fa.b%2Fc%3Fd%3D1&text=A%20%26%20B",
    );
  });
});
