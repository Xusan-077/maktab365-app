// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { ApiError } from "@/lib/api/types";
import uz from "@/lib/i18n/messages/uz.json";
import type { AdminPdfBook } from "@/lib/admin/types";

const api = vi.hoisted(() => ({
  pdfBook: vi.fn(),
  subjects: vi.fn(),
  updatePdfBook: vi.fn(),
  deletePdfBook: vi.fn(),
  transitionPdfBook: vi.fn(),
  duplicatePdfBook: vi.fn(),
}));
const router = vi.hoisted(() => ({ push: vi.fn() }));
const identity = vi.hoisted(() => ({ role: "admin", email: "a@example.com" }));

vi.mock("@/lib/admin/api", () => ({ getAdminApi: () => api }));
vi.mock("./AdminRoleProvider", () => ({ useAdminIdentity: () => identity }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => router,
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("./usePdfUpload", () => ({
  usePdfUpload: () => ({ state: { phase: "idle" }, run: vi.fn() }),
}));

import { PdfBookEditView } from "./PdfBookEditView";

const t = uz.admin.toc;
const BOOK = {
  id: "book-1",
  title: { uz: "Algebra 9" },
  description: "Eski tavsif",
  chapters: [
    {
      id: "c1",
      title: "Kirish",
      page: 1,
      children: [{ id: "c1a", title: "Maqsad", page: 2 }],
    },
  ],
  grade: 9,
  subject: "algebra",
  has_file: true,
  page_count: 10,
  size_bytes: 2048,
  status: "draft",
  allowed_transitions: [],
  updated_at: "2026-01-01T00:00:00Z",
  cover_url: null,
} as unknown as AdminPdfBook;

function setup(book: Partial<AdminPdfBook> = {}) {
  api.pdfBook.mockResolvedValue({ ...BOOK, ...book });
  api.subjects.mockResolvedValue([{ slug: "algebra", title: { uz: "Algebra" } }]);
  api.updatePdfBook.mockResolvedValue(BOOK);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <PdfBookEditView id="book-1" />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const form = async () => await screen.findByTestId("pdf-details-form");
const save = (root: HTMLElement) =>
  within(root).getByRole("button", { name: uz.admin.common.save }) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe("PdfBookEditView: tavsif va mundarija", () => {
  it("mavjud tavsif va mundarijani ko'rsatadi; o'zgarmaguncha «Saqlash» o'chiq", async () => {
    setup();
    const root = await form();
    expect((within(root).getByTestId("pdf-description-input") as HTMLTextAreaElement).value).toBe(
      "Eski tavsif",
    );
    expect(
      within(root)
        .getAllByTestId("toc-title")
        .map((i) => (i as HTMLInputElement).value),
    ).toEqual(["Kirish", "Maqsad"]);
    expect(save(root).disabled).toBe(true);
  });

  it("har saqlangan qatorda ixtiyoriy prezentatsiya boshqaruvi; yangi qatorda saqlash kerakligi aytiladi", async () => {
    const withSlides = {
      ...BOOK,
      chapters: [
        {
          id: "c1",
          title: "Kirish",
          page: 1,
          slides: { name: "kirish.pdf", page_count: 9, size_bytes: 1024, updated_at: null },
          children: [{ id: "c1a", title: "Maqsad", page: 2, slides: null }],
        },
      ],
    };
    setup({ chapters: withSlides.chapters } as Partial<AdminPdfBook>);
    const root = await form();

    const controls = within(root).getAllByTestId("chapter-slides");
    expect(controls.map((c) => c.dataset.hasSlides)).toEqual(["true", "false"]);
    expect(within(root).getByTestId("slides-info").textContent).toContain("kirish.pdf");
    expect(within(root).queryByTestId("slides-hint")).toBeNull();

    fireEvent.click(within(root).getByTestId("toc-add"));

    const all = within(root).getAllByTestId("chapter-slides");
    expect(all).toHaveLength(3);
    expect(within(all[2]).getByTestId("slides-hint").textContent).toBe(
      uz.admin.slides.saveRowFirst,
    );
    expect(save(root).disabled).toBe(true); // prezentatsiya mundarija formasini "o'zgargan" qilmaydi
  });

  it("o'zgartirib saqlaydi: tavsif va butun mundarija PATCH qilinadi", async () => {
    setup();
    const root = await form();
    fireEvent.change(within(root).getByTestId("pdf-description-input"), {
      target: { value: "Yangi tavsif" },
    });
    fireEvent.click(within(root).getByTestId("toc-add"));
    const titles = within(root).getAllByTestId("toc-title");
    const pages = within(root).getAllByTestId("toc-page");
    fireEvent.change(titles[2], { target: { value: "Algebra" } });
    fireEvent.change(pages[2], { target: { value: "5" } });
    fireEvent.click(save(root));

    await waitFor(() =>
      expect(api.updatePdfBook).toHaveBeenCalledWith("book-1", {
        description: "Yangi tavsif",
        chapters: [
          // Saqlangan bo'limlar `id` bilan ketadi (prezentatsiyasi saqlanadi), yangisi `id` siz.
          {
            id: "c1",
            title: "Kirish",
            page: 1,
            children: [{ id: "c1a", title: "Maqsad", page: 2 }],
          },
          { title: "Algebra", page: 5 },
        ],
      }),
    );
  });

  it("bet PDF betlaridan oshsa yuborilmaydi", async () => {
    setup();
    const root = await form();
    fireEvent.change(within(root).getAllByTestId("toc-page")[0], { target: { value: "11" } });
    fireEvent.click(save(root));

    expect(
      await within(root).findByText(t.problems.pageExceeds.replace("{pages}", "10")),
    ).toBeTruthy();
    expect(api.updatePdfBook).not.toHaveBeenCalled();
  });

  it("backend xatosi mundarija ostida ko'rsatiladi", async () => {
    setup();
    api.updatePdfBook.mockRejectedValue(
      new ApiError("x", 400, {
        code: "validation_error",
        details: { chapters: ["chapter_title_required"] },
      }),
    );
    const root = await form();
    fireEvent.change(within(root).getByTestId("pdf-description-input"), { target: { value: "x" } });
    fireEvent.click(save(root));

    expect(await within(root).findByTestId("chapters-error")).toBeTruthy();
    expect(within(root).getByTestId("chapters-error").textContent).toBe(
      uz.admin.errors.fields.chapter_title_required,
    );
  });

  it("mundarijani butunlay tozalash mumkin", async () => {
    setup();
    const root = await form();
    fireEvent.click(within(root).getByLabelText(t.remove.replace("{n}", "1")));
    expect(within(root).getByText(t.empty)).toBeTruthy();
    fireEvent.click(save(root));
    await waitFor(() =>
      expect(api.updatePdfBook).toHaveBeenCalledWith("book-1", {
        description: "Eski tavsif",
        chapters: [],
      }),
    );
  });

  it("fayl yuklanmagan kitobda bet chegarasi tekshirilmaydi", async () => {
    setup({ has_file: false, page_count: 0 });
    const root = await form();
    // Oxirgi qator: bet tartibi buzilmaydi, faqat yuqori chegara (yo'q) tekshiriladi.
    fireEvent.change(within(root).getAllByTestId("toc-page").at(-1)!, {
      target: { value: "500" },
    });
    fireEvent.click(save(root));
    await waitFor(() => expect(api.updatePdfBook).toHaveBeenCalled());
  });
});

describe("PdfBookEditView: nusxalash va oldindan ko'rish", () => {
  it("«Nusxalash» qoralama yaratadi va uning sahifasiga o'tadi", async () => {
    api.duplicatePdfBook.mockResolvedValue({ id: "copy-1" });
    setup();
    fireEvent.click(await screen.findByRole("button", { name: uz.admin.pdfEdit.duplicate }));
    await waitFor(() => expect(api.duplicatePdfBook).toHaveBeenCalledWith("book-1"));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/kitoblar/copy-1"));
  });

  it("fayli bor kitobda o'quvchi ko'rinishiga havola bor, fayli yo'qda yo'q", async () => {
    setup();
    const link = await screen.findByRole("link", { name: uz.admin.pdfEdit.preview });
    expect(link.getAttribute("href")).toBe("/admin/kitoblar/book-1/korish");
    cleanup();
    setup({ has_file: false });
    await screen.findByRole("button", { name: uz.admin.pdfEdit.duplicate });
    expect(screen.queryByRole("link", { name: uz.admin.pdfEdit.preview })).toBeNull();
  });
});
