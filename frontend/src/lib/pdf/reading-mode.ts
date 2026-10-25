/**
 * O'qish rejimlari (sof funksiyalar): «Kitob» (`b`, ochiq kitob — varaq ag'darish; ≥1024px da
 * ikki bet yonma-yon) va «Uzluksiz» (`v`, vertikal scroll, virtualizatsiya bilan).
 */

export const READING_MODES = ["b", "v"] as const;
export type ReadingMode = (typeof READING_MODES)[number];

export const isReadingMode = (value: unknown): value is ReadingMode =>
  READING_MODES.includes(value as ReadingMode);

/** Eski «Surish» rejimi (`h`) — endi «Kitob». */
const LEGACY_MODES: Record<string, ReadingMode> = { h: "b" };

/** Xotiradagi yoki URL'dagi qiymat: `b` | `v` (eski `h` → `b`), boshqasi — `null`. */
export function toReadingMode(value: unknown): ReadingMode | null {
  if (isReadingMode(value)) return value;
  return typeof value === "string" ? (LEGACY_MODES[value] ?? null) : null;
}

/** `?mode=` qiymati: `b` | `v` (eski `h` → `b`), boshqasi — `null` (aytilmagan). */
export function parseModeParam(raw: string | null | undefined): ReadingMode | null {
  return toReadingMode(raw?.trim().toLowerCase());
}

/** URL > saqlangan tanlov > standart: «Kitob». */
export function resolveMode(url: ReadingMode | null, stored: ReadingMode | null): ReadingMode {
  return url ?? stored ?? "b";
}

/**
 * Yoyma (2 bet): 1-bet (muqova) yolg'iz o'ngda, keyin 2–3, 4–5… juft. `[chap, o'ng]`, bo'sh tomon
 * `null`. Yoyma bo'lmasa (bitta bet) — `[page]`.
 */
export function spreadPages(page: number, total: number, spread: boolean): (number | null)[] {
  if (!spread) return [page];
  if (page <= 1) return [null, 1];
  const left = page % 2 === 0 ? page : page - 1;
  return [left, left + 1 <= total ? left + 1 : null];
}

/** Yoymaning birinchi (chapdagi yoki yolg'iz) beti — sahifa almashganda shu betga o'tiladi. */
export function spreadStart(page: number, spread: boolean): number {
  if (!spread || page <= 1) return page;
  return page % 2 === 0 ? page : page - 1;
}

/** Keyingi yoyma/bet boshi; oxirida `null`. */
export function nextSpread(page: number, total: number, spread: boolean): number | null {
  const next = spread ? (page <= 1 ? 2 : spreadStart(page, true) + 2) : page + 1;
  return next <= total ? next : null;
}

/** Oldingi yoyma/bet boshi; boshida `null`. */
export function prevSpread(page: number, spread: boolean): number | null {
  if (!spread) return page > 1 ? page - 1 : null;
  const start = spreadStart(page, true);
  if (start <= 1) return null;
  return start === 2 ? 1 : start - 2;
}

/** Joriy bet atrofida chiziladigan betlar oralig'i (`radius` — har tomonga). */
export function renderWindow(
  current: number,
  total: number,
  radius: number,
): { from: number; to: number } {
  return { from: Math.max(1, current - radius), to: Math.min(total, current + radius) };
}

/**
 * Vertikal ro'yxat joylashuvi: har betning yuqori nuqtasi (px, ro'yxat boshidan) va umumiy
 * balandlik. `heights[i]` — `i + 1`-bet balandligi.
 */
export function pageOffsets(heights: number[], gap: number): { tops: number[]; total: number } {
  const tops: number[] = [];
  let y = 0;
  for (const [index, height] of heights.entries()) {
    tops.push(y);
    y += height + (index < heights.length - 1 ? gap : 0);
  }
  return { tops, total: y };
}

/**
 * Markazi `center` (ro'yxat boshidan px) nuqtasiga eng yaqin bet (1 dan). Ikkilik qidiruv:
 * 240 betda ham har scroll'da arzon.
 */
export function pageAtCenter(tops: number[], heights: number[], center: number): number {
  if (tops.length === 0) return 1;
  let low = 0;
  let high = tops.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (tops[mid] <= center) low = mid;
    else high = mid - 1;
  }
  // `low` — boshi markazdan yuqoridagi oxirgi bet; oraliqqa tushsa keyingisi bilan solishtiriladi.
  const distance = (index: number) => {
    const top = tops[index];
    const bottom = top + heights[index];
    return center < top ? top - center : center > bottom ? center - bottom : 0;
  };
  const next = low + 1;
  return next < tops.length && distance(next) < distance(low) ? next + 1 : low + 1;
}
