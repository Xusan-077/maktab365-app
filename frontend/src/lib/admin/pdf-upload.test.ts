import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/types";
import {
  proxyUploadUrl,
  slidesProxyUrl,
  uploadPdf,
  type SendRequest,
  type SendResult,
  type Sender,
} from "./pdf-upload";
import { partCountFor, partSizeFor } from "./pdf-parts";
import type { AdminPdfBook, PdfUploadPlan } from "./types";

const BOOK = { id: "b1", page_count: 4 } as AdminPdfBook;

function pdfFile(size: number): File {
  return new File([new Uint8Array(size)], "kitob.pdf", { type: "application/pdf" });
}

function makeApi(plan: PdfUploadPlan) {
  return {
    initPdfUpload: vi.fn().mockResolvedValue(plan),
    completePdfUpload: vi.fn().mockResolvedValue(BOOK),
  };
}

const ok = (etag: string | null = null, json: unknown = null): SendResult => ({
  status: 200,
  etag,
  json,
});

describe("uploadPdf — proxy rejimi (lokal)", () => {
  it("faylni BFF orqali bitta multipart so'rov bilan yuboradi", async () => {
    const api = makeApi({ mode: "proxy", part_size: 0, part_urls: [], expires_in: 900 });
    const send = vi.fn<Sender>().mockResolvedValue(ok(null, BOOK));
    const progress: number[] = [];

    const result = await uploadPdf({
      api,
      send,
      bookId: "b1",
      file: pdfFile(10),
      onProgress: (f) => progress.push(f),
    });

    expect(result).toBe(BOOK);
    const request = send.mock.calls[0][0];
    expect(request.method).toBe("POST");
    expect(request.url).toBe(proxyUploadUrl("b1"));
    expect(request.url.endsWith("/")).toBe(false);
    expect((request.body as FormData).get("file")).toBeInstanceOf(File);
    expect(api.completePdfUpload).not.toHaveBeenCalled();
    expect(progress.at(-1)).toBe(1);
  });

  it("backend xatosini barqaror kod bilan ApiError qiladi", async () => {
    const api = makeApi({ mode: "proxy", part_size: 0, part_urls: [], expires_in: 900 });
    const send = vi
      .fn<Sender>()
      .mockResolvedValue({ status: 400, etag: null, json: { code: "invalid_pdf", message: "x" } });

    await expect(uploadPdf({ api, send, bookId: "b1", file: pdfFile(10) })).rejects.toMatchObject({
      code: "invalid_pdf",
      status: 400,
    });
  });
});

describe("uploadPdf — direct rejimi (R2/S3)", () => {
  const plan: PdfUploadPlan = {
    mode: "direct",
    part_size: 4,
    part_urls: ["https://r2/1", "https://r2/2", "https://r2/3"],
    expires_in: 900,
  };

  it("bo'laklarga bo'lib yuboradi va ETag'lar bilan yakunlaydi", async () => {
    const api = makeApi(plan);
    const seen: SendRequest[] = [];
    const send: Sender = async (request) => {
      seen.push(request);
      request.onProgress((request.body as Blob).size);
      return ok(`"etag-${request.url.at(-1)}"`);
    };
    const progress: number[] = [];

    const result = await uploadPdf({
      api,
      send,
      bookId: "b1",
      file: pdfFile(10),
      onProgress: (f) => progress.push(f),
      retryDelayMs: 0,
    });

    expect(result).toBe(BOOK);
    expect(api.initPdfUpload).toHaveBeenCalledWith("b1", {
      name: "kitob.pdf",
      size: 10,
      type: "application/pdf",
    });
    expect(seen.map((r) => (r.body as Blob).size).sort()).toEqual([2, 4, 4]);
    expect(seen.every((r) => r.method === "PUT")).toBe(true);
    expect(api.completePdfUpload).toHaveBeenCalledWith("b1", [
      { part_number: 1, etag: '"etag-1"' },
      { part_number: 2, etag: '"etag-2"' },
      { part_number: 3, etag: '"etag-3"' },
    ]);
    expect(progress.every((f, i) => i === 0 || f >= 0)).toBe(true);
    expect(progress.at(-1)).toBe(1);
  });

  it("vaqtincha xatoda bo'lakni qayta yuboradi", async () => {
    const api = makeApi(plan);
    let calls = 0;
    const send: Sender = async (request) => {
      calls += 1;
      if (request.url.endsWith("/2") && calls < 4) return { status: 503, etag: null, json: null };
      return ok('"e"');
    };

    await uploadPdf({ api, send, bookId: "b1", file: pdfFile(10), retryDelayMs: 0 });

    expect(calls).toBeGreaterThan(3);
    expect(api.completePdfUpload).toHaveBeenCalledTimes(1);
  });

  it("qayta urinishlar tugasa xato beradi va yakunlamaydi", async () => {
    const api = makeApi(plan);
    const send: Sender = async () => ({ status: 500, etag: null, json: null });

    await expect(
      uploadPdf({ api, send, bookId: "b1", file: pdfFile(10), retries: 1, retryDelayMs: 0 }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(api.completePdfUpload).not.toHaveBeenCalled();
  });

  it("ETag bo'lmasa (CORS ExposeHeaders yo'q) xato", async () => {
    const api = makeApi(plan);
    const send: Sender = async () => ok(null);

    await expect(
      uploadPdf({ api, send, bookId: "b1", file: pdfFile(10), retries: 0, retryDelayMs: 0 }),
    ).rejects.toMatchObject({ code: "upload_failed" });
  });

  it("bekor qilinsa to'xtaydi", async () => {
    const api = makeApi(plan);
    const controller = new AbortController();
    const send: Sender = async () => {
      controller.abort();
      return ok('"e"');
    };

    await expect(
      uploadPdf({
        api,
        send,
        bookId: "b1",
        file: pdfFile(10),
        signal: controller.signal,
        concurrency: 1,
        retryDelayMs: 0,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(api.completePdfUpload).not.toHaveBeenCalled();
  });
});

describe("uploadPdf — juda katta fayl", () => {
  it("5 GB faylni hisoblangan bo'laklar soni bilan yuboradi va yakunlaydi", async () => {
    const size = 5 * 1024 ** 3;
    const partSize = partSizeFor(size);
    const count = partCountFor(size, partSize);
    expect(count).toBe(640);
    const plan: PdfUploadPlan = {
      mode: "direct",
      part_size: partSize,
      part_urls: Array.from({ length: count }, (_, i) => `https://r2/${i + 1}`),
      expires_in: 900,
    };
    // 5 GB xotirada ushlanmaydi: faqat `size` va `slice` kerak.
    const file = {
      name: "katta.pdf",
      type: "application/pdf",
      size,
      slice: (start: number, end: number) => ({ size: end - start }),
    } as unknown as File;
    const api = makeApi(plan);
    const sizes: number[] = [];
    const send: Sender = async (request) => {
      const blobSize = (request.body as Blob).size;
      sizes.push(blobSize);
      request.onProgress(blobSize);
      return ok(`"e${request.url.split("/").at(-1)}"`);
    };
    const progress: number[] = [];

    await uploadPdf({ api, send, bookId: "b1", file, onProgress: (f) => progress.push(f) });

    expect(sizes).toHaveLength(640);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(size);
    const parts = api.completePdfUpload.mock.calls[0][1] as { part_number: number }[];
    expect(parts.map((p) => p.part_number)).toEqual(Array.from({ length: 640 }, (_, i) => i + 1));
    expect(progress.at(-1)).toBe(1);
  });
});

describe("uploadPdf — bo'lim prezentatsiyasi (umumiy mexanizm)", () => {
  it("proxy rejimida berilgan manzilga yuboradi", async () => {
    const api = makeApi({ mode: "proxy", part_size: 0, part_urls: [], expires_in: 900 });
    const send = vi.fn<Sender>().mockResolvedValue(ok(null, BOOK));

    await uploadPdf({
      api,
      send,
      bookId: "b1",
      file: pdfFile(10),
      proxyUrl: slidesProxyUrl("b1", "c9"),
    });

    expect(send.mock.calls[0][0].url).toBe(
      "/api/backend/api/v1/admin/pdf-books/b1/chapters/c9/slides/upload",
    );
  });

  it("direct rejimida yiqilsa tugallanmagan yuklash bekor qilinadi (asl xato saqlanadi)", async () => {
    const plan: PdfUploadPlan = {
      mode: "direct",
      part_size: 4,
      part_urls: ["https://r2/1", "https://r2/2"],
      expires_in: 900,
    };
    const abort = vi.fn().mockRejectedValue(new Error("abort ham yiqildi"));
    const api = { ...makeApi(plan), abortPdfUpload: abort };
    const send: Sender = async () => ({ status: 503, etag: null, json: null });

    await expect(
      uploadPdf({ api, send, bookId: "b1", file: pdfFile(8), retries: 0, retryDelayMs: 0 }),
    ).rejects.toMatchObject({ status: 503 });

    expect(abort).toHaveBeenCalledWith("b1");
    expect(api.completePdfUpload).not.toHaveBeenCalled();
  });

  it("bekor qilinganda (AbortSignal) ham abort chaqiriladi", async () => {
    const plan: PdfUploadPlan = {
      mode: "direct",
      part_size: 4,
      part_urls: ["https://r2/1"],
      expires_in: 900,
    };
    const abort = vi.fn().mockResolvedValue(undefined);
    const api = { ...makeApi(plan), abortPdfUpload: abort };
    const controller = new AbortController();
    controller.abort();

    await expect(
      uploadPdf({ api, send: vi.fn(), bookId: "b1", file: pdfFile(4), signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(abort).toHaveBeenCalledTimes(1);
  });

  it("muvaffaqiyatli yuklashda abort chaqirilmaydi", async () => {
    const plan: PdfUploadPlan = {
      mode: "direct",
      part_size: 4,
      part_urls: ["https://r2/1"],
      expires_in: 900,
    };
    const abort = vi.fn();
    const api = { ...makeApi(plan), abortPdfUpload: abort };
    const send: Sender = async () => ok('"e"');

    await uploadPdf({ api, send, bookId: "b1", file: pdfFile(4) });

    expect(abort).not.toHaveBeenCalled();
  });
});
