import { BFF_PREFIX } from "./config";

/** BFF va hisob route'lari uchun so'rov tekshiruvlari (sof funksiyalar). */

export const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const errorResponse = (status: number, code: string, message: string) =>
  Response.json({ code, message }, { status });

/**
 * CSRF: sessiya cookie bilan ishlagani uchun o'zgartiruvchi so'rovlar faqat shu saytdan.
 * Brauzer `Sec-Fetch-Site` yoki `Origin` yuboradi; ikkalasi ham yo'q — brauzer emas (cookie'siz).
 */
export function isSameOrigin(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return true;
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * `/api/backend/api/v1/me` → `/api/v1/me/`; boshqa yo'llar (`/admin` …) uzatilmaydi.
 * Next route'gacha oxirgi `/` ni olib tashlaydi (308), backend yo'llari esa `/` bilan tugaydi —
 * shuning uchun klient slash'siz yuboradi, bu yerda qayta qo'shiladi.
 */
export function upstreamPath(pathname: string): string | null {
  const path = pathname.startsWith(BFF_PREFIX) ? pathname.slice(BFF_PREFIX.length) : "";
  if (!path.startsWith("/api/v1/") || path.includes("..")) return null;
  return path.endsWith("/") ? path : `${path}/`;
}

/**
 * Admin yozuvi (kontent o'zgardi) muvaffaqiyatli bo'lsa, Next'dagi ochiq katalog keshi (`content`
 * tegi, `lib/api/server.ts`) eskirgan: keyingi so'rovda yangilanadi.
 */
export function changesPublicContent(method: string, path: string, status: number): boolean {
  return (
    !SAFE_METHODS.has(method) && path.startsWith("/api/v1/admin/") && status >= 200 && status < 300
  );
}

/** Brauzerdan BFF'ga: oxirgi `/` siz (Next'ning 308 yo'naltirishisiz). */
export function toBffUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.pathname.startsWith(`${BFF_PREFIX}/`) && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.toString();
}

/** BFF orqali o'tadigan so'rov tanasi chegarasi: oddiy API so'rovlari (JSON, muqova rasmi). */
export const MAX_BODY_BYTES = 12 * 1024 * 1024;
/**
 * Lokal (dev) PDF yuklash `POST …/admin/pdf-books/<id>/upload/` backend orqali ketadi; prod'da PDF
 * baytlari BFF'dan o'tmaydi (to'g'ridan-to'g'ri R2/S3). Hajm chegarasini backend
 * (`PDF_BOOK_MAX_BYTES`, ixtiyoriy) belgilaydi, BFF'da bu yo'l uchun chegara yo'q.
 */
export const MAX_PDF_BODY_BYTES = Number.POSITIVE_INFINITY;
const PDF_UPLOAD_PATH = /^\/api\/v1\/admin\/pdf-books\/[0-9a-f-]{36}\/upload\/$/;

export const isPdfUploadPath = (path: string) => PDF_UPLOAD_PATH.test(path);

const PDF_FILE_PATH = /^\/api\/v1\/pdf-books\/[0-9a-f-]{36}\/file\/$/;

/** Lokal (dev) PDF fayl endpoint'i: Range va kesh sarlavhalari BFF orqali o'tadi. */
export const isPdfFilePath = (path: string) => PDF_FILE_PATH.test(path);

export function bodyLimitFor(path: string): number {
  return isPdfUploadPath(path) ? MAX_PDF_BODY_BYTES : MAX_BODY_BYTES;
}

/** `Content-Length` chegaradan oshsa (tanani o'qimasdan) rad etish uchun. */
export function declaresTooLargeBody(request: Request, path: string): boolean {
  const length = Number(request.headers.get("content-length"));
  return Number.isFinite(length) && length > bodyLimitFor(path);
}
