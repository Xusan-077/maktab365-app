// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { ApiError } from "@/lib/api/types";
import uz from "@/lib/i18n/messages/uz.json";
import type { AdminPdfBook, AdminSubject } from "@/lib/admin/types";

const api = vi.hoisted(() => ({
  pdfBooks: vi.fn(),
  subjects: vi.fn(),
  deletePdfBook: vi.fn(),
}));
const identity = vi.hoisted(() => ({ role: "admin" }));
const nav = vi.hoisted(() => ({ replace: vi.fn(), query: "" }));
const toast = vi.hoisted(() => vi.fn());

vi.mock("@/lib/admin/api", () => ({ getAdminApi: () => api }));
vi.mock("./AdminRoleProvider", () => ({ useAdminIdentity: () => identity }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast }) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.query) }));
vi.mock("@/lib/i18n/navigation", () => ({
  usePathname: () => "/admin/kitoblar",
  useRouter: () => ({ replace: nav.replace }),
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PdfBooksView } from "./PdfBooksView";

const t = uz.admin.pdfBooks;
const book = (over: Partial<AdminPdfBook>): AdminPdfBook =>
  ({
    id: "b1",
    title: { uz: "Algebra 9" },
    grade: 9,
    subject: "algebra",
    status: "published",
    has_file: true,
    page_count: 120,
    size_bytes: 3 * 1024 * 1024,
    cover_url: null,
    updated_at: "2026-01-02T00:00:00Z",
    ...over,
  }) as AdminPdfBook;
const BOOKS = [
  book({}),
  book({ id: "b2", title: { uz: "Fizika 8" }, grade: 8, subject: "fizika", status: "draft" }),
];
const SUBJECTS = [
  { id: "s1", slug: "algebra", title: { uz: "Algebra" }, order: 1, pdf_books_count: 1 },
  { id: "s2", slug: "fizika", title: { uz: "Fizika" }, order: 2, pdf_books_count: 1 },
] as AdminSubject[];

function setup(role = "admin") {
  identity.role = role;
  api.pdfBooks.mockResolvedValue({ count: BOOKS.length, results: BOOKS });
  api.subjects.mockResolvedValue(SUBJECTS);
  api.deletePdfBook.mockResolvedValue(undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <PdfBooksView />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const label = (template: string, title: string) => template.replace("{title}", title);

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  nav.query = "";
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

describe("PdfBooksView (admin)", () => {
  it("har qatorda muqova, fan nomi, Tahrirlash va O'chirish amallari bor", async () => {
    setup();
    const table = await screen.findByTestId("pdf-books-table");

    const edit = within(table).getByRole("link", { name: label(t.editLabel, "Algebra 9") });
    expect(edit.getAttribute("href")).toBe("/admin/kitoblar/b1");
    expect(
      within(table).getByRole("button", { name: label(t.deleteLabel, "Fizika 8") }),
    ).toBeTruthy();
    // Kitob muqovasi yo'q: generativ muqova va fan nomi (slug emas).
    expect(within(table).getAllByTestId("generated-cover")).toHaveLength(2);
    expect(within(table).getAllByText("Fizika").length).toBeGreaterThan(0);
  });

  it("o'chirish tasdiqlash dialogida kitob nomi bilan so'raydi va tasdiqlagach o'chiradi", async () => {
    setup();
    await screen.findByTestId("pdf-books-table");

    fireEvent.click(screen.getByRole("button", { name: label(t.deleteLabel, "Algebra 9") }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("«Algebra 9»");
    expect(api.deletePdfBook).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: uz.admin.common.delete }));

    await waitFor(() => expect(api.deletePdfBook).toHaveBeenCalledWith("b1"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", title: uz.admin.pdfEdit.deleted }),
      ),
    );
  });

  it("saqlash xatosida aniq xabar ko'rsatadi va dialog ochiq qoladi", async () => {
    setup();
    api.deletePdfBook.mockRejectedValue(
      new ApiError("x", 502, { code: "storage_error", details: undefined }),
    );
    await screen.findByTestId("pdf-books-table");

    fireEvent.click(screen.getByRole("button", { name: label(t.deleteLabel, "Algebra 9") }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: uz.admin.common.delete }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toBe(uz.admin.errors.codes.storage_error);
  });

  it("editor o'chirish tugmasini ko'rmaydi, tahrirlashni ko'radi", async () => {
    setup("editor");
    const table = await screen.findByTestId("pdf-books-table");

    expect(
      within(table).queryByRole("button", { name: label(t.deleteLabel, "Algebra 9") }),
    ).toBeNull();
    expect(within(table).getByRole("link", { name: label(t.editLabel, "Algebra 9") })).toBeTruthy();
  });

  it("filtrlar URL parametrlari bilan so'rovga uzatiladi", async () => {
    nav.query = "grade=8&status=draft&q=fizika";
    setup();
    await screen.findByTestId("pdf-books-table");

    expect(api.pdfBooks).toHaveBeenCalledWith(
      expect.objectContaining({ grade: 8, status: "draft", search: "fizika" }),
    );
  });
});
