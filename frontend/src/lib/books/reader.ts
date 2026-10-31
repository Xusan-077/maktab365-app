/**
 * Kitoblar o'qish oynasining sof mantiqi: bet, mundarija, oldindan yuklash va ko'rinish sozlamalari.
 * (Bet raqami, swipe va zoom uchun `lib/pdf/{page-nav,swipe,zoom}` qayta ishlatiladi.)
 */

import type { BookChapter } from "./api";

/** Joriy betdan keyingi nechta bet rasmi oldindan yuklanadi. */
export const PREFETCH_AHEAD = 2;

/** `0–100`: o'qilgan ulush (oxirgi ochilgan bet / jami). */
export function progressPercent(page: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((page / total) * 100)));
}

/** Oxirgi ochilgan bet bo'yicha tugma holati: hali boshlanmagan / davom / tugagan. */
export type ResumeState = "start" | "continue" | "finished";

export function resumeState(lastPage: number | null, total: number): ResumeState {
  if (!lastPage || lastPage <= 1) return "start";
  if (total > 0 && lastPage >= total) return "finished";
  return "continue";
}

/** Betga to'g'ri keladigan bo'lim: boshlanish beti shu betdan oshmagan oxirgisi. */
export function currentChapter<T extends Pick<BookChapter, "start_page">>(
  chapters: readonly T[],
  page: number,
): T | null {
  let found: T | null = null;
  for (const chapter of chapters) {
    if (chapter.start_page <= page && (!found || chapter.start_page >= found.start_page)) {
      found = chapter;
    }
  }
  return found;
}

/** Oldindan yuklanadigan keyingi betlar (jami sahifadan oshmaydi). */
export function pagesToPrefetch(page: number, total: number, ahead = PREFETCH_AHEAD): number[] {
  const pages: number[] = [];
  for (let next = page + 1; next <= Math.min(total, page + ahead); next += 1) pages.push(next);
  return pages;
}

/** Sahifaga o'tish uchun qadam: oxiri va boshidan chiqib ketmaydi. */
export function stepPage(page: number, total: number, direction: 1 | -1): number {
  return Math.min(Math.max(page + direction, 1), Math.max(total, 1));
}

/* ---------- Ko'rinish sozlamalari (qurilma bo'yicha) ---------- */

export const BOOK_VIEWS = ["page", "text"] as const;
export type BookView = (typeof BOOK_VIEWS)[number];

export const BOOK_THEMES = ["paper", "sepia", "night"] as const;
export type BookTheme = (typeof BOOK_THEMES)[number];

export const BOOK_FONTS = ["serif", "sans"] as const;
export type BookFont = (typeof BOOK_FONTS)[number];

export const MIN_FONT_SIZE = 14;
export const MAX_FONT_SIZE = 30;
export const FONT_SIZE_STEP = 2;
export const LINE_HEIGHTS = [1.4, 1.6, 1.8, 2] as const;
export type LineHeight = (typeof LINE_HEIGHTS)[number];

export interface BookReaderPrefs {
  view: BookView;
  theme: BookTheme;
  font: BookFont;
  fontSize: number;
  lineHeight: LineHeight;
}

export const DEFAULT_BOOK_PREFS: BookReaderPrefs = {
  view: "page",
  theme: "paper",
  font: "serif",
  fontSize: 20,
  lineHeight: 1.8,
};

export function clampFontSize(size: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size)));
}

export function stepFontSize(size: number, direction: 1 | -1): number {
  return clampFontSize(size + direction * FONT_SIZE_STEP);
}

/** Xotiradan o'qilgan qiymatlardan faqat yaroqlilari (qolgani standart). */
export function sanitizeBookPrefs(value: unknown): BookReaderPrefs {
  const raw = (
    typeof value === "object" && value !== null ? value : {}
  ) as Partial<BookReaderPrefs>;
  return {
    view: BOOK_VIEWS.includes(raw.view as BookView)
      ? (raw.view as BookView)
      : DEFAULT_BOOK_PREFS.view,
    theme: BOOK_THEMES.includes(raw.theme as BookTheme)
      ? (raw.theme as BookTheme)
      : DEFAULT_BOOK_PREFS.theme,
    font: BOOK_FONTS.includes(raw.font as BookFont)
      ? (raw.font as BookFont)
      : DEFAULT_BOOK_PREFS.font,
    fontSize:
      typeof raw.fontSize === "number" && Number.isFinite(raw.fontSize)
        ? clampFontSize(raw.fontSize)
        : DEFAULT_BOOK_PREFS.fontSize,
    lineHeight: LINE_HEIGHTS.includes(raw.lineHeight as LineHeight)
      ? (raw.lineHeight as LineHeight)
      : DEFAULT_BOOK_PREFS.lineHeight,
  };
}

/** Matn rejimi faqat matn qatlami bor kitobda; qolganida har doim bet rasmi. */
export function effectiveView(view: BookView, hasText: boolean): BookView {
  return view === "text" && hasText ? "text" : "page";
}

/** Matnni xatboshilarga ajratish: bo'sh qatorlar oraliq, qator ichidagi sinishlar bo'shliqqa aylanadi. */
export function toParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

export interface TextPart {
  text: string;
  match: boolean;
}

/** Qidiruv natijasi parchasini moslik bo'yicha bo'laklaydi (katta-kichik harfga e'tiborsiz). */
export function splitMatches(text: string, query: string): TextPart[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const parts: TextPart[] = [];
  let from = 0;
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}
