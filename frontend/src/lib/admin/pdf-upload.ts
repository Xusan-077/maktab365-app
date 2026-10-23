import { ApiError } from "@/lib/api/types";
import { BFF_PREFIX } from "@/lib/auth/config";
import type { AdminPdfBook, PdfUploadPart, PdfUploadPlan } from "./types";

/** Bitta HTTP yuborish (XHR: yuklash progressi uchun `fetch` yetmaydi); testda almashtiriladi. */
export interface SendRequest {
  method: "PUT" | "POST";
  url: string;
  body: Blob | FormData;
  onProgress: (loaded: number) => void;
  signal?: AbortSignal;
}

export interface SendResult {
  status: number;
  etag: string | null;
  /** JSON tana (bo'lsa); boshqa holda `null`. */
  json: unknown;
}

export type Sender = (request: SendRequest) => Promise<SendResult>;

/** Yuklash uchun kerak bo'lgan admin API qismi. */
export interface PdfUploadApi {
  initPdfUpload(
    id: string,
    file: { name: string; size: number; type: string },
  ): Promise<PdfUploadPlan>;
  completePdfUpload(id: string, parts: PdfUploadPart[]): Promise<AdminPdfBook>;
  /** Ixtiyoriy: bo'laklab yuklash yiqilsa/bekor qilinsa chaqiriladi (tugallanmagan yuklashni tozalaydi). */
  abortPdfUpload?(id: string): Promise<void>;
}

export interface UploadPdfOptions {
  api: PdfUploadApi;
  send: Sender;
  bookId: string;
  file: File;
  /** 0..1 */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  /** `proxy` (lokal dev) rejimidagi manzil; berilmasa kitob PDF'i yo'li (`proxyUploadUrl`). */
  proxyUrl?: string;
  /** Bir vaqtda yuboriladigan bo'laklar (S3 rejimi). */
  concurrency?: number;
  /** Bitta bo'lak uchun qayta urinishlar soni. */
  retries?: number;
  /** Qayta urinishlar orasidagi kutish (ms); testda 0. */
  retryDelayMs?: number;
}

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 800;

/** Brauzerdan BFF orqali backend'ga (dev "proxy" rejimi): oxirgi `/` siz. */
export const proxyUploadUrl = (bookId: string) =>
  `${BFF_PREFIX}/api/v1/admin/pdf-books/${bookId}/upload`;

/** Bo'lim prezentatsiyasi uchun `proxy` (lokal dev) manzili: oxirgi `/` siz. */
export const slidesProxyUrl = (bookId: string, chapterId: string) =>
  `${BFF_PREFIX}/api/v1/admin/pdf-books/${bookId}/chapters/${chapterId}/slides/upload`;

/** Backend xato tanasi (`{code, message, details?}`) → `ApiError`. */
function toApiError(result: SendResult): ApiError {
  const body = result.json as { code?: string; message?: string; details?: never } | null;
  return new ApiError(body?.message ?? `HTTP ${result.status}`, result.status, {
    code: body?.code ?? "upload_failed",
    details: body?.details,
  });
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

/**
 * PDF'ni yuklaydi va tayyor `AdminPdfBook` qaytaradi.
 * - `proxy` (lokal dev): fayl backend'ga multipart bilan, bitta so'rovda.
 * - `direct` (R2/S3): fayl bo'laklarga bo'linib imzolangan URL'larga PUT qilinadi (progress, qayta
 *   urinish bilan), so'ng `upload-complete` ETag'lar bilan chaqiriladi. Baytlar BFF/backend'dan o'tmaydi.
 */
export async function uploadPdf(options: UploadPdfOptions): Promise<AdminPdfBook> {
  const { api, send, bookId, file, signal, onProgress } = options;
  const plan = await api.initPdfUpload(bookId, {
    name: file.name,
    size: file.size,
    type: file.type || "application/pdf",
  });
  const report = (loaded: number) => onProgress?.(Math.min(1, loaded / Math.max(1, file.size)));

  if (plan.mode === "proxy") {
    const form = new FormData();
    form.set("file", file);
    const result = await send({
      method: "POST",
      url: options.proxyUrl ?? proxyUploadUrl(bookId),
      body: form,
      onProgress: report,
      signal,
    });
    if (result.status < 200 || result.status >= 300) throw toApiError(result);
    onProgress?.(1);
    return result.json as AdminPdfBook;
  }

  try {
    return await uploadParts({ ...options, plan, report });
  } catch (error) {
    // Bekor qilish yoki yiqilish: tugallanmagan yuklash tozalanadi (xatosi asosiy xatoni yashirmaydi).
    await api.abortPdfUpload?.(bookId).catch(() => undefined);
    throw error;
  }
}

interface PartsOptions extends UploadPdfOptions {
  plan: PdfUploadPlan;
  report: (loaded: number) => void;
}

/** S3/R2 (`direct`): bo'laklarni parallel yuboradi va `upload-complete` ni ETag'lar bilan chaqiradi. */
async function uploadParts(options: PartsOptions): Promise<AdminPdfBook> {
  const { api, send, bookId, file, signal, onProgress, plan, report } = options;
  const partCount = plan.part_urls.length;
  const loadedByPart = new Array<number>(partCount).fill(0);
  const etags = new Array<string>(partCount);
  const retries = options.retries ?? DEFAULT_RETRIES;
  const retryDelay = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const total = () => loadedByPart.reduce((sum, value) => sum + value, 0);

  const sendPart = async (index: number): Promise<void> => {
    const start = index * plan.part_size;
    const blob = file.slice(start, Math.min(file.size, start + plan.part_size));
    for (let attempt = 0; ; attempt += 1) {
      if (signal?.aborted) throw abortError();
      try {
        loadedByPart[index] = 0;
        const result = await send({
          method: "PUT",
          url: plan.part_urls[index],
          body: blob,
          onProgress: (loaded) => {
            loadedByPart[index] = loaded;
            report(total());
          },
          signal,
        });
        if (result.status < 200 || result.status >= 300) throw toApiError(result);
        if (!result.etag) throw new ApiError("ETag yo'q", result.status, { code: "upload_failed" });
        loadedByPart[index] = blob.size;
        report(total());
        etags[index] = result.etag;
        return;
      } catch (error) {
        loadedByPart[index] = 0;
        if (signal?.aborted || attempt >= retries) throw error;
        await wait(retryDelay * (attempt + 1));
      }
    }
  };

  // Navbat: har ishchi keyingi bo'lakni oladi; biror bo'lak yiqilsa qolganlari to'xtaydi.
  let next = 0;
  let failed: unknown;
  const worker = async () => {
    while (failed === undefined && next < partCount) {
      const index = next;
      next += 1;
      try {
        await sendPart(index);
      } catch (error) {
        failed ??= error;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(options.concurrency ?? DEFAULT_CONCURRENCY, partCount) }, worker),
  );
  if (failed !== undefined) throw failed;

  const parts = etags.map((etag, index) => ({ part_number: index + 1, etag }));
  const book = await api.completePdfUpload(bookId, parts);
  onProgress?.(1);
  return book;
}

/** Brauzer uchun `Sender`: `XMLHttpRequest` (upload progress), JSON javobni o'qiydi. */
export const xhrSender: Sender = ({ method, url, body, onProgress, signal }) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };
    xhr.onload = () => {
      let json: unknown = null;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        json = null;
      }
      resolve({ status: xhr.status, etag: xhr.getResponseHeader("ETag"), json });
    };
    xhr.onerror = () =>
      reject(new ApiError("Server bilan aloqa yo'q", 0, { code: "network_error" }));
    xhr.onabort = () => reject(abortError());
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
