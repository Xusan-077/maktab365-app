// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
}));
const progress = vi.hoisted(() => ({
  state: { ready: true, position: null as null | { page: number }, resume: 1, record: vi.fn() },
}));
const api = vi.hoisted(() => ({ book: vi.fn() }));

vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params }));
vi.mock("@/lib/i18n/navigation", () => ({
  usePathname: () => "/darsliklar/book-1",
  useRouter: () => ({ replace: nav.replace }),
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/hooks/usePdfProgress", () => ({ usePdfProgress: () => progress.state }));
vi.mock("@/lib/pdf-books/api", () => ({
  getPdfBooksApi: () => api,
  PDF_PAGE_SIZE: 24,
}));
vi.mock("./PdfBookmarkButton", () => ({ PdfBookmarkButton: () => null }));
vi.mock("@/components/support/ReportErrorLink", () => ({ ReportErrorLink: () => null }));
vi.mock("./usePdfDocument", () => ({
  usePdfDocument: () => ({ doc: { numPages: 240 }, loading: false, error: null, reload: vi.fn() }),
}));
vi.mock("./PdfPageCanvas", () => ({
  PdfPageCanvas: ({ pageNumber }: { pageNumber: number }) => (
    <div data-testid="pdf-canvas" data-page={pageNumber} />
  ),
}));

import { PdfReader } from "./PdfReader";

function setup(query = "") {
  nav.params = new URLSearchParams(query);
  api.book.mockResolvedValue({
    id: "book-1",
    title: { uz: "Algebra 9" },
    page_count: 240,
    grade: 9,
    subject: "algebra",
    subject_title: { uz: "Algebra" },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <PdfReader bookId="book-1" />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const currentPage = async () => (await screen.findByTestId("pdf-canvas")).dataset.page;

beforeEach(() => {
  vi.clearAllMocks();
  progress.state = { ready: true, position: null, resume: 1, record: vi.fn() };
});
afterEach(cleanup);

describe("PdfReader", () => {
  it("?page=12 bo'yicha shu sahifani chizadi va «12 / 240» ni ko'rsatadi", async () => {
    setup("page=12");
    expect(await currentPage()).toBe("12");
    expect((screen.getByTestId("pdf-page-input") as HTMLInputElement).value).toBe("12");
    expect(screen.getByTestId("pdf-page-total").textContent).toBe("/ 240");
    expect(nav.replace).not.toHaveBeenCalled(); // URL allaqachon to'g'ri
  });

  it("chegaradan tashqari ?page= ni tuzatadi va URL'ni yangilaydi", async () => {
    setup("page=999");
    expect(await currentPage()).toBe("240");
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=240", { scroll: false }),
    );
  });

  it("?page= bo'lmasa saqlangan sahifadan davom etadi va URL'ga yozadi", async () => {
    progress.state = { ready: true, position: { page: 37 }, resume: 37, record: vi.fn() };
    setup();
    expect(await currentPage()).toBe("37");
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=37", { scroll: false }),
    );
  });

  it("pozitsiya hali aniqlanmagan bo'lsa sahifa chizilmaydi", async () => {
    progress.state = { ready: false, position: null, resume: 1, record: vi.fn() };
    setup();
    await screen.findByTestId("pdf-reader");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByTestId("pdf-canvas")).toBeNull();
  });

  it("← / → klavishlari sahifani suradi", async () => {
    setup("page=5");
    await currentPage();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(nav.replace).toHaveBeenNthCalledWith(1, "/darsliklar/book-1?page=6", {
      scroll: false,
    });
    expect(nav.replace).toHaveBeenNthCalledWith(2, "/darsliklar/book-1?page=4", {
      scroll: false,
    });
  });

  it("matn maydonida yozayotganda strelka klavishlari sahifani o'zgartirmaydi", async () => {
    setup("page=5");
    await currentPage();
    fireEvent.keyDown(screen.getByTestId("pdf-page-input"), { key: "ArrowRight" });
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("birinchi sahifada ←, oxirgisida → hech narsa qilmaydi", async () => {
    setup("page=1");
    await currentPage();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(nav.replace).not.toHaveBeenCalled();
    cleanup();
    setup("page=240");
    await currentPage();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("mobilda chapga swipe — keyingi sahifa, o'ngga — oldingi", async () => {
    setup("page=5");
    const canvas = await screen.findByTestId("pdf-canvas");
    const area = canvas.parentElement as HTMLElement;
    const swipe = (fromX: number, toX: number) => {
      fireEvent.pointerDown(area, { pointerType: "touch", clientX: fromX, clientY: 100 });
      fireEvent.pointerUp(area, { pointerType: "touch", clientX: toX, clientY: 105 });
    };
    swipe(300, 100);
    swipe(100, 300);
    expect(nav.replace).toHaveBeenNthCalledWith(1, "/darsliklar/book-1?page=6", {
      scroll: false,
    });
    expect(nav.replace).toHaveBeenNthCalledWith(2, "/darsliklar/book-1?page=4", {
      scroll: false,
    });
  });

  it("sichqoncha harakati swipe hisoblanmaydi", async () => {
    setup("page=5");
    const area = (await screen.findByTestId("pdf-canvas")).parentElement as HTMLElement;
    fireEvent.pointerDown(area, { pointerType: "mouse", clientX: 300, clientY: 100 });
    fireEvent.pointerUp(area, { pointerType: "mouse", clientX: 100, clientY: 100 });
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("joriy sahifani eslab qolish uchun progress'ga yozadi", async () => {
    setup("page=9");
    await currentPage();
    await waitFor(() => expect(progress.state.record).toHaveBeenCalledWith(9));
  });

  it("topilmagan kitob uchun xabar ko'rsatadi", async () => {
    const { ApiError } = await import("@/lib/api/types");
    nav.params = new URLSearchParams();
    api.book.mockRejectedValue(new ApiError("x", 404, { code: "not_found" }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <NextIntlClientProvider locale="uz" messages={uz}>
        <QueryClientProvider client={client}>
          <PdfReader bookId="book-1" />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );
    expect(await screen.findByText(uz.pdfBooks.reader.notFound)).toBeTruthy();
  });
});
