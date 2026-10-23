// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { ApiError } from "@/lib/api/types";
import uz from "@/lib/i18n/messages/uz.json";
import type * as PdfUploadModule from "@/lib/admin/pdf-upload";
import type { AdminSlides } from "@/lib/admin/types";

const api = vi.hoisted(() => ({
  initSlidesUpload: vi.fn(),
  completeSlidesUpload: vi.fn(),
  abortSlidesUpload: vi.fn(),
  deleteSlides: vi.fn(),
}));
const upload = vi.hoisted(() => ({ uploadPdf: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());

vi.mock("@/lib/admin/api", () => ({ getAdminApi: () => api }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/admin/pdf-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof PdfUploadModule>()),
  uploadPdf: upload.uploadPdf,
}));

import { ChapterSlides, type SlidesContext } from "./ChapterSlides";

const t = uz.admin.slides;
const SLIDES: AdminSlides = {
  name: "algebra-slaydlar.pdf",
  page_count: 24,
  size_bytes: 3 * 1024 * 1024,
  updated_at: null,
};
const pdf = (name = "slaydlar.pdf", type = "application/pdf", size = 10) =>
  new File([new Uint8Array(size)], name, { type });

interface Setup {
  row?: { id?: string; title?: string };
  bookId?: string;
  slides?: AdminSlides | null;
  canDelete?: boolean;
}

function setup({
  row = { id: "ch-1" },
  bookId = "book-1",
  slides = null,
  canDelete = true,
}: Setup = {}) {
  const context: SlidesContext = {
    bookId,
    byId: new Map(row.id ? [[row.id, slides]] : []),
    canDelete,
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <ChapterSlides
          context={context}
          row={{ key: "k", title: row.title ?? "Kirish", page: "1", id: row.id }}
          position="2"
        />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { invalidate };
}

const choose = (file: File) =>
  fireEvent.change(screen.getByTestId("slides-input"), { target: { files: [file] } });
const addButton = () => screen.getByRole("button", { name: t.addFor.replace("{n}", "2") });

beforeEach(() => {
  vi.clearAllMocks();
  api.abortSlidesUpload.mockResolvedValue(undefined);
  api.deleteSlides.mockResolvedValue({});
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

describe("ChapterSlides", () => {
  it("prezentatsiyasiz saqlangan bo'limda ixtiyoriy «Qo'shish» tugmasi va belgi yo'q", () => {
    setup();

    expect(screen.getByTestId("chapter-slides").dataset.hasSlides).toBe("false");
    expect(screen.getByText(t.optional)).toBeTruthy();
    expect((addButton() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId("slides-hint")).toBeNull();
    expect(screen.queryByRole("button", { name: /o'chirish/i })).toBeNull();
    expect(upload.uploadPdf).not.toHaveBeenCalled(); // tugmani bosmasak hech narsa o'zgarmaydi
  });

  it("saqlanmagan (id siz) qatorda yuklash o'chiq va nima qilish aytilgan", () => {
    setup({ row: {} });

    expect((addButton() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("slides-hint").textContent).toBe(t.saveRowFirst);
    expect((screen.getByTestId("slides-input") as HTMLInputElement).disabled).toBe(true);
  });

  it("yangi kitob wizard'ida (kitob id'si yo'q) yuklash kitob saqlangandan keyin", () => {
    setup({ bookId: "" }); // wizard: kitob hali saqlanmagan

    expect((addButton() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("slides-hint").textContent).toBe(t.saveBookFirst);
  });

  it("biriktirilgan prezentatsiya: belgi, fayl nomi, slayd soni va hajm; Almashtirish va O'chirish", () => {
    setup({ slides: SLIDES });

    expect(screen.getByTestId("chapter-slides").dataset.hasSlides).toBe("true");
    expect(screen.getByTestId("slides-info").textContent).toBe(
      "algebra-slaydlar.pdf · 24 slayd · 3 MB",
    );
    expect(screen.getByRole("button", { name: t.replaceFor.replace("{n}", "2") })).toBeTruthy();
    expect(screen.getByRole("button", { name: t.removeFor.replace("{n}", "2") })).toBeTruthy();
  });

  it("editor (o'chirish huquqisiz) faqat Almashtirishni ko'radi", () => {
    setup({ slides: SLIDES, canDelete: false });

    expect(screen.getByRole("button", { name: t.replaceFor.replace("{n}", "2") })).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.removeFor.replace("{n}", "2") })).toBeNull();
  });

  it("PDF bo'lmagan fayl rad etiladi va yuklash boshlanmaydi", () => {
    setup();

    choose(pdf("slaydlar.pptx", "application/vnd.ms-powerpoint"));

    expect(screen.getByRole("alert").textContent).toBe(uz.admin.pdfUpload.problems.notPdf);
    expect(upload.uploadPdf).not.toHaveBeenCalled();
  });

  it("tanlangan PDF yuklanadi: bo'lim/kitob id'lari bilan, progress, so'ng yangilash va xabar", async () => {
    let finish: () => void = () => {};
    upload.uploadPdf.mockImplementation(
      ({ onProgress }: { onProgress: (n: number) => void }) =>
        new Promise<void>((resolve) => {
          onProgress(0.4);
          finish = resolve;
        }),
    );
    const { invalidate } = setup();

    choose(pdf("slaydlar.pdf"));

    const status = await screen.findByTestId("slides-progress");
    expect(within(status).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
    expect(status.textContent).toContain("slaydlar.pdf");
    const call = upload.uploadPdf.mock.calls[0][0];
    expect(call.bookId).toBe("book-1");
    expect(call.proxyUrl).toBe(
      "/api/backend/api/v1/admin/pdf-books/book-1/chapters/ch-1/slides/upload",
    );

    // Adapter backend chaqiruvlarini bo'lim id'si bilan yuboradi.
    await call.api.initPdfUpload("book-1", { name: "a.pdf", size: 1, type: "application/pdf" });
    expect(api.initSlidesUpload).toHaveBeenCalledWith("book-1", "ch-1", expect.any(Object));
    await call.api.completePdfUpload("book-1", [{ part_number: 1, etag: '"e"' }]);
    expect(api.completeSlidesUpload).toHaveBeenCalledWith(
      "book-1",
      "ch-1",
      [{ part_number: 1, etag: '"e"' }],
      "slaydlar.pdf",
    );
    await call.api.abortPdfUpload("book-1");
    expect(api.abortSlidesUpload).toHaveBeenCalledWith("book-1", "ch-1");

    finish();
    await waitFor(() => expect(screen.queryByTestId("slides-progress")).toBeNull());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", title: t.uploaded }),
    );
    expect(invalidate).toHaveBeenCalled();
  });

  it("«Bekor qilish» yuklashni to'xtatadi va xato ko'rsatilmaydi", async () => {
    upload.uploadPdf.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    setup();
    choose(pdf());
    await screen.findByTestId("slides-progress");

    fireEvent.click(screen.getByRole("button", { name: t.cancel }));

    await waitFor(() => expect(screen.queryByTestId("slides-progress")).toBeNull());
    expect(screen.queryByTestId("slides-error")).toBeNull();
    expect((addButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it("yuklash xatosi: xabar va «Qayta urinish» o'sha fayl bilan; boshqa narsaga tegmaydi", async () => {
    upload.uploadPdf
      .mockRejectedValueOnce(new ApiError("x", 502, { code: "upload_failed", details: undefined }))
      .mockResolvedValueOnce(undefined);
    setup();

    choose(pdf("slaydlar.pdf"));

    const error = await screen.findByTestId("slides-error");
    expect(error.textContent).toContain(uz.admin.errors.codes.upload_failed);
    fireEvent.click(within(error).getByRole("button", { name: t.retry }));

    await waitFor(() => expect(upload.uploadPdf).toHaveBeenCalledTimes(2));
    expect(upload.uploadPdf.mock.calls[1][0].file.name).toBe("slaydlar.pdf");
    await waitFor(() => expect(screen.queryByTestId("slides-error")).toBeNull());
  });

  it("o'chirish tasdiqlash dialogi bilan: bo'lim nomi yoziladi, tasdiqlagach so'rov ketadi", async () => {
    const { invalidate } = setup({ slides: SLIDES, row: { id: "ch-1", title: "Kirish" } });

    fireEvent.click(screen.getByRole("button", { name: t.removeFor.replace("{n}", "2") }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("«Kirish»");
    expect(api.deleteSlides).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: uz.admin.common.delete }));

    await waitFor(() => expect(api.deleteSlides).toHaveBeenCalledWith("book-1", "ch-1"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", title: t.deleted }),
      ),
    );
    expect(invalidate).toHaveBeenCalled();
  });

  it("o'chirishda saqlash xatosi (502) aniq ko'rsatiladi", async () => {
    api.deleteSlides.mockRejectedValue(
      new ApiError("x", 502, { code: "storage_error", details: undefined }),
    );
    setup({ slides: SLIDES });

    fireEvent.click(screen.getByRole("button", { name: t.removeFor.replace("{n}", "2") }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: uz.admin.common.delete }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toBe(uz.admin.errors.codes.storage_error);
  });
});
