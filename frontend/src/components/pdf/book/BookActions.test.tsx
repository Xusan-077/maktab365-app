// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { ApiError } from "@/lib/api/types";
import uz from "@/lib/i18n/messages/uz.json";

const api = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock("@/lib/pdf-books/api", () => ({ getPdfBooksApi: () => api }));
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
  sizeBytes: 10 * 1024 * 1024,
  allowDownload: true,
};

function setup(over: Partial<typeof props> = {}) {
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <BookActions {...props} {...over} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("BookActions", () => {
  it("«Onlayn o'qish» o'qish oynasiga olib boradi", () => {
    setup();
    const link = screen.getByRole("link", { name: t.read });
    expect(link.getAttribute("href")).toBe("/darsliklar/9/9-sinf-algebra/oqish");
  });

  it("yuklab olish: URL olinadi va fayl nomi bilan yuklash boshlanadi", async () => {
    api.download.mockResolvedValue({
      url: "https://r2.test/book.pdf?sig=1",
      filename: "Algebra - 9-sinf - Maktab365.pdf",
      expires_in: 600,
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    setup();
    fireEvent.click(screen.getByRole("button", { name: /PDF yuklab olish \(10 MB\)/ }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(api.download).toHaveBeenCalledWith("b1");
    click.mockRestore();
  });

  it("yuklab olish o'chirilgan kitobda tugma yo'q, izoh bor", () => {
    setup({ allowDownload: false });
    expect(screen.queryByRole("button", { name: /PDF yuklab olish/ })).toBeNull();
    expect(screen.getByText(t.downloadDisabled)).toBeTruthy();
    expect(screen.getByRole("link", { name: t.read })).toBeTruthy();
  });

  it("server 403 download_disabled qaytarsa izoh ko'rsatiladi, boshqa xatoda — xato", async () => {
    api.download.mockRejectedValueOnce(
      new ApiError("x", 403, { code: "download_disabled", requestId: "r" }),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: /PDF yuklab olish/ }));
    expect(await screen.findByText(t.downloadDisabled)).toBeTruthy();
    cleanup();

    api.download.mockRejectedValueOnce(new ApiError("x", 500, { code: "server_error" }));
    setup();
    fireEvent.click(screen.getByRole("button", { name: /PDF yuklab olish/ }));
    expect(await screen.findByText(t.downloadFailed)).toBeTruthy();
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
