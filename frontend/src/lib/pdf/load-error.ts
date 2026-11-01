import { ApiError } from "@/lib/api/types";

/**
 * PDF ochilmagan sabab (foydalanuvchiga tushunarli xabar — `pdfBooks.reader.loadErrors.<sabab>`):
 * - `offline` — brauzer internetsiz (`navigator.onLine === false`);
 * - `network` — serverga ulanib bo'lmadi (fetch yiqildi, `network_error`);
 * - `timeout` — imzolangan URL yoki PDF o'zi juda uzoq yuklandi;
 * - `notFound` — kitob yoki fayl yo'q (404);
 * - `forbidden` — API ruxsat bermadi (401/403);
 * - `expired` — fayl ombori imzolangan URL'ni rad etdi (muddati tugagan; yangi URL bilan tiklanadi);
 * - `damaged` — fayl PDF emas, buzilgan yoki parol bilan himoyalangan;
 * - `server` — 5xx yoki 429;
 * - `unknown` — boshqa.
 */
export type PdfLoadProblem =
  | "offline"
  | "network"
  | "timeout"
  | "notFound"
  | "forbidden"
  | "expired"
  | "damaged"
  | "server"
  | "unknown";

/** PDF belgilangan vaqtda ochilmadi (`usePdfDocument` qo'yadi). */
export class PdfLoadTimeoutError extends Error {
  constructor() {
    super("PDF yuklash vaqti tugadi");
    this.name = "PdfLoadTimeoutError";
  }
}

/** pdf.js xatolari nomi bo'yicha (klasslar dinamik import qilinadigan modulda). */
const DAMAGED = new Set(["InvalidPDFException", "FormatError", "PasswordException"]);
const RESPONSE = new Set([
  "ResponseException",
  "UnexpectedResponseException",
  "MissingPDFException",
]);

const fromStatus = (status: number): PdfLoadProblem | null => {
  if (status === 404 || status === 410) return "notFound";
  if (status === 429 || status >= 500) return "server";
  return null;
};

export function classifyPdfError(error: unknown, online = true): PdfLoadProblem {
  if (!online) return "offline";
  if (error instanceof PdfLoadTimeoutError) return "timeout";
  if (error instanceof ApiError) {
    if (error.code === "timeout") return "timeout";
    if (error.code === "network_error" || error.status === 0) return "network";
    if (error.status === 401 || error.status === 403) return "forbidden";
    return fromStatus(error.status) ?? "unknown";
  }
  if (typeof error !== "object" || error === null) return "unknown";
  const { name, status, missing } = error as { name?: string; status?: number; missing?: boolean };
  if (name && DAMAGED.has(name)) return "damaged";
  if (name && RESPONSE.has(name)) {
    if (missing || name === "MissingPDFException") return "notFound";
    // Fayl ombori (R2/S3) imzosi eskirgan yoki rad etilgan URL.
    if (status === 401 || status === 403) return "expired";
    if (!status) return "network";
    return fromStatus(status) ?? "unknown";
  }
  // `fetch` tarmoq xatosi (Chrome: «Failed to fetch», Firefox: «NetworkError…», Safari: «Load failed»).
  if (error instanceof TypeError) return "network";
  return "unknown";
}

/** Bir marta jim (avtomatik) qayta urinish mumkin bo'lgan sabab: yangi imzolangan URL bilan. */
export const autoRetriable = (problem: PdfLoadProblem) => problem === "expired";
