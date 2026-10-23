// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { ApiError } from "@/lib/api/types";
import uz from "@/lib/i18n/messages/uz.json";
import type { AdminPdfBook } from "@/lib/admin/types";

const api = vi.hoisted(() => ({
  subjects: vi.fn(),
  createPdfBook: vi.fn(),
  updatePdfBook: vi.fn(),
  upload: vi.fn(),
}));
const router = vi.hoisted(() => ({ push: vi.fn() }));
const upload = vi.hoisted(() => ({ uploadPdf: vi.fn() }));
const cover = vi.hoisted(() => ({ renderCoverFile: vi.fn() }));

vi.mock("@/lib/admin/api", () => ({ getAdminApi: () => api }));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/admin/pdf-upload", () => ({ uploadPdf: upload.uploadPdf, xhrSender: vi.fn() }));
vi.mock("@/lib/pdf/thumbnail", () => cover);

import { PdfBookWizard } from "./PdfBookWizard";

const t = uz.admin.pdfWizard;
const td = uz.admin.toc;
const BOOK = { id: "book-1", page_count: 3 } as AdminPdfBook;

function setup() {
  api.subjects.mockResolvedValue([{ slug: "algebra", title: { uz: "Algebra" } }]);
  api.createPdfBook.mockResolvedValue({ id: "book-1" });
  api.updatePdfBook.mockResolvedValue(BOOK);
  api.upload.mockResolvedValue({ path: "covers/c.jpg" });
  upload.uploadPdf.mockResolvedValue(BOOK);
  cover.renderCoverFile.mockResolvedValue(new File(["j"], "cover.jpg", { type: "image/jpeg" }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <PdfBookWizard />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const pick = (file: File) =>
  fireEvent.change(screen.getByTestId("pdf-input"), { target: { files: [file] } });
const pdf = () => new File([new Uint8Array(8)], "algebra.pdf", { type: "application/pdf" });

async function toFileStep() {
  const next = () => screen.getByRole("button", { name: t.next });
  expect((next() as HTMLButtonElement).disabled).toBe(true); // sinf tanlanmaguncha yo'q
  fireEvent.click(screen.getByTestId("pdf-grade-5"));
  fireEvent.click(next());
  fireEvent.click(await screen.findByTestId("pdf-subject-algebra"));
  fireEvent.click(next());
  fireEvent.change(await screen.findByLabelText(uz.admin.localized.uz), {
    target: { value: "Algebra 5" },
  });
}

/** Nom + PDF → «Davom etish» → «Tavsif va mundarija» qadami. */
async function toDetailsStep() {
  await toFileStep();
  pick(pdf());
  fireEvent.click(screen.getByRole("button", { name: t.next }));
  await screen.findByTestId("toc-editor");
}

const fillRow = (index: number, title: string, page: string) => {
  fireEvent.change(screen.getAllByTestId("toc-title")[index], { target: { value: title } });
  fireEvent.change(screen.getAllByTestId("toc-page")[index], { target: { value: page } });
};
const titles = () =>
  screen.getAllByTestId("toc-title").map((input) => (input as HTMLInputElement).value);
const withChapters = (call: unknown[]) => "chapters" in (call[1] as Record<string, unknown>);

beforeEach(() => {
  vi.clearAllMocks();
  // `Select` (useMediaQuery) uchun: jsdom'da matchMedia yo'q.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe("PdfBookWizard", () => {
  it("sinf → fan → nom+PDF → o'tkazib yuborish: yozuv yaratadi, yuklaydi, muqovani PATCH qiladi", async () => {
    setup();
    await toDetailsStep();
    fireEvent.click(screen.getByTestId("pdf-skip-details"));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/kitoblar/book-1"));
    expect(api.createPdfBook).toHaveBeenCalledWith({
      title: { uz: "Algebra 5" },
      grade: 5,
      subject: "algebra",
    });
    expect(upload.uploadPdf).toHaveBeenCalledWith(
      expect.objectContaining({ bookId: "book-1", file: expect.any(File) }),
    );
    expect(api.upload).toHaveBeenCalledWith(expect.any(File), "cover");
    expect(api.updatePdfBook).toHaveBeenCalledWith("book-1", { cover: "covers/c.jpg" });
    // O'tkazib yuborilganda tavsif/mundarija yuborilmaydi.
    expect(api.updatePdfBook.mock.calls.some(withChapters)).toBe(false);
  });

  it("tavsif va mundarija PDF yuklangandan keyin saqlanadi", async () => {
    setup();
    await toDetailsStep();
    fireEvent.change(screen.getByTestId("pdf-description-input"), {
      target: { value: "  Sinf darsligi  " },
    });
    fireEvent.click(screen.getByTestId("toc-add"));
    fillRow(0, "Kirish", "1");
    fireEvent.click(screen.getByLabelText(td.addChildFor.replace("{n}", "1")));
    fillRow(1, "Maqsad", "2");
    fireEvent.click(screen.getByRole("button", { name: t.start }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/kitoblar/book-1"));
    const index = api.updatePdfBook.mock.calls.findIndex(withChapters);
    expect(api.updatePdfBook.mock.calls[index]).toEqual([
      "book-1",
      {
        description: "Sinf darsligi",
        chapters: [{ title: "Kirish", page: 1, children: [{ title: "Maqsad", page: 2 }] }],
      },
    ]);
    // Betlar soni PDF dan tekshirilishi uchun avval fayl yuklanadi.
    expect(upload.uploadPdf.mock.invocationCallOrder[0]).toBeLessThan(
      api.updatePdfBook.mock.invocationCallOrder[index],
    );
  });

  it("mundarija bo'sh bo'lsa «Yuklash va saqlash» faqat faylni yuklaydi", async () => {
    setup();
    await toDetailsStep();
    fireEvent.click(screen.getByRole("button", { name: t.start }));

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(api.updatePdfBook.mock.calls.some(withChapters)).toBe(false);
  });

  it("ommaviy kiritish jadvalni to'ldiradi", async () => {
    setup();
    await toDetailsStep();
    const bulk = screen.getByTestId("toc-bulk");
    fireEvent.change(bulk.querySelector("textarea")!, {
      target: { value: "1. Kirish ........ 1\n  Maqsad 2\nBet yo'q\n2. Algebra .... 3" },
    });
    fireEvent.click(screen.getByRole("button", { name: td.bulk.apply }));

    expect(screen.getAllByTestId("toc-title")).toHaveLength(3);
    expect(titles()[0]).toBe("1. Kirish");
    expect((screen.getAllByTestId("toc-page")[1] as HTMLInputElement).value).toBe("2");
    expect(screen.getByText(/3 qator qo'shildi/)).toBeTruthy();
    expect(screen.getByText(/1 qator o'qilmadi/)).toBeTruthy();
  });

  it("qatorlarni yuqoriga/pastga suradi va o'chiradi", async () => {
    setup();
    await toDetailsStep();
    fireEvent.click(screen.getByTestId("toc-add"));
    fireEvent.click(screen.getByTestId("toc-add"));
    fillRow(0, "Birinchi", "1");
    fillRow(1, "Ikkinchi", "2");
    fireEvent.click(screen.getByLabelText(td.moveDown.replace("{n}", "1")));
    expect(titles()).toEqual(["Ikkinchi", "Birinchi"]);
    fireEvent.click(screen.getByLabelText(td.remove.replace("{n}", "1")));
    expect(titles()).toEqual(["Birinchi"]);
  });

  it("sarlavhasiz qator yuborilmaydi", async () => {
    setup();
    await toDetailsStep();
    fireEvent.click(screen.getByTestId("toc-add"));
    fillRow(0, "", "4");
    fireEvent.click(screen.getByRole("button", { name: t.start }));

    expect(await screen.findByText(td.problems.titleRequired)).toBeTruthy();
    expect(api.createPdfBook).not.toHaveBeenCalled();
  });

  it("bet PDF dan katta bo'lsa xato ko'rsatiladi; tuzatilgach fayl qayta yuklanmaydi", async () => {
    setup();
    api.updatePdfBook.mockImplementation(async (_id: string, body: Record<string, unknown>) => {
      if (JSON.stringify(body.chapters ?? []).includes('"page":99')) {
        throw new ApiError("x", 400, {
          code: "validation_error",
          details: { chapters: ["chapter_page_exceeds"] },
        });
      }
      return BOOK;
    });
    await toDetailsStep();
    fireEvent.click(screen.getByTestId("toc-add"));
    fillRow(0, "Oxiri", "99");
    fireEvent.click(screen.getByRole("button", { name: t.start }));

    expect(await screen.findByTestId("chapters-error")).toBeTruthy();
    expect(screen.getByTestId("chapters-error").textContent).toBe(
      uz.admin.errors.fields.chapter_page_exceeds,
    );
    expect(router.push).not.toHaveBeenCalled();

    // Endi PDF 3 bet ekani ma'lum: mijoz o'zi ham tekshiradi.
    fireEvent.click(screen.getByRole("button", { name: t.retry }));
    expect(await screen.findByText(td.problems.pageExceeds.replace("{pages}", "3"))).toBeTruthy();
    fillRow(0, "Oxiri", "3");
    fireEvent.click(screen.getByRole("button", { name: t.retry }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/kitoblar/book-1"));
    expect(api.createPdfBook).toHaveBeenCalledTimes(1);
    expect(upload.uploadPdf).toHaveBeenCalledTimes(1);
  });

  it("PDF bo'lmagan faylni rad etadi va keyingi qadamga o'tmaydi", async () => {
    setup();
    await toFileStep();
    pick(new File(["x"], "rasm.png", { type: "image/png" }));

    expect(await screen.findByText(uz.admin.pdfUpload.problems.notPdf)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.next }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId("toc-editor")).toBeNull();
    expect(api.createPdfBook).not.toHaveBeenCalled();
  });

  it("fayl tanlanmasa keyingi qadamga o'tmaydi", async () => {
    setup();
    await toFileStep();
    fireEvent.click(screen.getByRole("button", { name: t.next }));

    expect(await screen.findByText(uz.admin.pdfUpload.problems.missing)).toBeTruthy();
    expect(screen.queryByTestId("toc-editor")).toBeNull();
    expect(api.createPdfBook).not.toHaveBeenCalled();
  });

  it("yuklash yiqilsa qayta urinish yangi yozuv yaratmaydi", async () => {
    setup();
    upload.uploadPdf.mockRejectedValueOnce(new ApiError("x", 400, { code: "invalid_pdf" }));
    await toDetailsStep();
    fireEvent.click(screen.getByTestId("pdf-skip-details"));

    expect(await screen.findByText(uz.admin.errors.codes.invalid_pdf)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: t.retry }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/kitoblar/book-1"));
    expect(api.createPdfBook).toHaveBeenCalledTimes(1);
    expect(upload.uploadPdf).toHaveBeenCalledTimes(2);
  });

  it("muqova yaratilmasa ham kitob saqlanadi", async () => {
    setup();
    cover.renderCoverFile.mockRejectedValue(new Error("canvas"));
    await toDetailsStep();
    fireEvent.click(screen.getByTestId("pdf-skip-details"));

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(api.updatePdfBook).not.toHaveBeenCalledWith("book-1", { cover: expect.anything() });
  });
});
