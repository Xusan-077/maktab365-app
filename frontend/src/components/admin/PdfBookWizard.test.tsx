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

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("PdfBookWizard", () => {
  it("sinf → fan → nom+PDF: yozuv yaratadi, yuklaydi, muqovani PATCH qiladi va kitobga o'tadi", async () => {
    setup();
    await toFileStep();
    pick(pdf());
    fireEvent.click(screen.getByRole("button", { name: t.start }));

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
  });

  it("PDF bo'lmagan faylni rad etadi va yuborilmaydi", async () => {
    setup();
    await toFileStep();
    pick(new File(["x"], "rasm.png", { type: "image/png" }));

    expect(await screen.findByText(uz.admin.pdfUpload.problems.notPdf)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.start }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.createPdfBook).not.toHaveBeenCalled();
  });

  it("fayl tanlanmasa yuborilmaydi", async () => {
    setup();
    await toFileStep();
    fireEvent.click(screen.getByRole("button", { name: t.start }));

    expect(await screen.findByText(uz.admin.pdfUpload.problems.missing)).toBeTruthy();
    expect(api.createPdfBook).not.toHaveBeenCalled();
  });

  it("yuklash yiqilsa qayta urinish yangi yozuv yaratmaydi", async () => {
    setup();
    upload.uploadPdf.mockRejectedValueOnce(new ApiError("x", 400, { code: "invalid_pdf" }));
    await toFileStep();
    pick(pdf());
    fireEvent.click(screen.getByRole("button", { name: t.start }));

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
    await toFileStep();
    pick(pdf());
    fireEvent.click(screen.getByRole("button", { name: t.start }));

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(api.updatePdfBook).not.toHaveBeenCalledWith("book-1", { cover: expect.anything() });
  });
});
