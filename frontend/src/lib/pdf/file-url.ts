import { BFF_PREFIX } from "@/lib/auth/config";

/**
 * Backend bergan o'qish URL'ini brauzer ochadigan manzilga aylantiradi.
 * - S3/R2: to'liq `https://…` imzolangan URL — o'zgarmaydi (fayl bevosita saqlashdan o'qiladi).
 * - Lokal (dev): backend yo'li `/api/v1/pdf-books/<id>/file/?token=…` — brauzer backend'ga faqat BFF
 *   orqali boradi, oxirgi `/` siz (Next 308 qilmasin; BFF qaytaradi).
 */
export function resolveFileUrl(url: string, origin: string): string {
  if (!url.startsWith("/api/v1/")) return url;
  const [path, query] = url.split("?", 2);
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  return `${origin}${BFF_PREFIX}${trimmed}${query ? `?${query}` : ""}`;
}
