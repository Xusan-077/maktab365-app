/** PDF viewer sahifa raqami qoidalari (1..N); sof funksiyalar. */

/** `total` dan tashqari qiymat eng yaqin chegaraga tushadi; yaroqsiz (NaN) qiymat — 1. */
export function clampPage(value: number, total: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(1, Math.trunc(value)), Math.max(1, total));
}

/**
 * `?page=` qiymati: bo'sh yoki raqam bo'lmasa `null` (sahifa aytilmagan), aks holda 1..N ga tuzatilgan.
 * `"12abc"`, `"-3"`, `"1.5"` kabi qiymatlar yaroqsiz hisoblanadi.
 */
export function parsePageParam(raw: string | null | undefined, total: number): number | null {
  if (raw == null || !/^\d+$/.test(raw.trim())) return null;
  return clampPage(Number(raw), total);
}

/**
 * Foydalanuvchi kiritgan matn: bo'sh/yaroqsiz bo'lsa joriy sahifa qoladi, 1..N dan tashqari qiymat
 * tuzatiladi (0 → 1, 999 → N).
 */
export function parsePageInput(text: string, current: number, total: number): number {
  const cleaned = text.trim();
  if (!/^-?\d+$/.test(cleaned)) return clampPage(current, total);
  return clampPage(Number(cleaned), total);
}
