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
