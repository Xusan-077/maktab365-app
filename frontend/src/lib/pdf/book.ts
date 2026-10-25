/**
 * «Kitob» rejimi (sof funksiyalar): yoyma (ochiq kitob), kitob o'lchami, zoom/pan chegaralari va
 * varaqlar to'plami qalinligi. Varaq ag'darish geometriyasi — `page-curl.ts`.
 */

import { nextSpread, prevSpread, spreadPages, spreadStart } from "./reading-mode";

/** Shu kenglikdan boshlab ikki bet yonma-yon (ochiq kitob); kichigida — bitta bet. */
export const BOOK_SPREAD_MIN_WIDTH = 1024;
/** Kitob stage chetidan shuncha px ichkarida. */
export const BOOK_PADDING = 28;
/** Zoom shundan katta bo'lsa sudrash varaq ag'darmaydi — faqat pan. */
export const BOOK_PAN_ZOOM = 1.05;
/** A4 nisbati — 1-bet o'lchami kelguncha. */
export const DEFAULT_PAGE_ASPECT = 1.414;

export interface BookSpread {
  /** Yoymaning boshi (URL'ga yoziladigan bet: chap bet yoki yolg'iz bet). */
  start: number;
  left: number | null;
  right: number | null;
}

/**
 * Yoyma: ikki betda haqiqiy kitobdek — 1-bet (muqova) yolg'iz o'ngda, keyin juft bet chapda, toq
 * bet o'ngda (2–3, 4–5…); juft sonli kitobning oxirgi beti yolg'iz chapda. Bitta betda — `right`.
 */
export function bookSpread(page: number, total: number, twoPage: boolean): BookSpread {
  if (!twoPage) return { start: page, left: null, right: page };
  const [left, right] = spreadPages(page, total, true);
  return { start: spreadStart(page, true), left, right };
}

/** Yoymadagi betlar (bo'sh tomonsiz), o'sish tartibida. */
export const spreadPageNumbers = (spread: BookSpread) =>
  [spread.left, spread.right].filter((value): value is number => value !== null);

/** «77–78-betlar» / «1-bet» uchun: yoymadagi birinchi va oxirgi bet. */
export function spreadRange(spread: BookSpread): { from: number; to: number } {
  const pages = spreadPageNumbers(spread);
  return { from: pages[0] ?? spread.start, to: pages[pages.length - 1] ?? spread.start };
}

/** Ag'darish yo'nalishi: 1 — oldinga, −1 — orqaga, 0 — o'sha yoyma. */
export const flipDirection = (fromStart: number, toStart: number): 1 | -1 | 0 =>
  toStart > fromStart ? 1 : toStart < fromStart ? -1 : 0;

/**
 * Qo'shni yoymagami (oddiy ag'darish) yoki uzoqqa sakrashmi (raqam, slider, mundarija — bir-bir
 * varaqlanmaydi: qisqa crossfade + bitta tez varaq).
 */
export function isNeighbourFlip(
  fromStart: number,
  toStart: number,
  total: number,
  twoPage: boolean,
): boolean {
  return (
    nextSpread(fromStart, total, twoPage) === toStart || prevSpread(fromStart, twoPage) === toStart
  );
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Bet o'lchami (px, butun): kitob (`twoPage` da 2 bet eni) stage ichiga `padding` bilan to'liq
 * sig'adi, nisbat (`aspect` = balandlik / en) saqlanadi.
 */
export function bookPageSize(aspect: number, twoPage: boolean, stage: Size, padding: number): Size {
  const columns = twoPage ? 2 : 1;
  const width = Math.max(0, stage.width - 2 * padding);
  const height = Math.max(0, stage.height - 2 * padding);
  if (!width || !height || !(aspect > 0)) return { width: 0, height: 0 };
  const pageWidth = Math.floor(Math.min(width / columns, height / aspect));
  return { width: pageWidth, height: Math.floor(pageWidth * aspect) };
}

/**
 * «Moslash» masshtabi: kitob (`book` — joylashuv o'lchami) hozirgi stage'ga sig'ishi uchun
 * ko'paytma. Stage o'zgarsa (oyna, Mavzu paneli) kitob qayta chizilmaydi — faqat shu masshtab.
 */
export function fitScale(book: Size, stage: Size, padding: number): number {
  if (!book.width || !book.height) return 1;
  const width = Math.max(1, stage.width - 2 * padding);
  const height = Math.max(1, stage.height - 2 * padding);
  return Math.min(width / book.width, height / book.height);
}

/**
 * Pan chegarasi (markazdan ± px): kitob stage'dan katta bo'lsa chetlari stage chetidan `padding`
 * dan ortiq ichkariga kirmaydi (kitob butunlay chiqib ketmaydi); kichik bo'lsa — 0 (markazda).
 */
export function panBounds(book: Size, scale: number, stage: Size, padding: number) {
  const axis = (content: number, view: number) =>
    content * scale > view ? (content * scale - view) / 2 + padding : 0;
  return { x: axis(book.width, stage.width), y: axis(book.height, stage.height) };
}

export function clampPan(pan: { x: number; y: number }, bounds: { x: number; y: number }) {
  const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value)) || 0;
  return { x: clamp(pan.x, bounds.x), y: clamp(pan.y, bounds.y) };
}

/**
 * Masshtab `from` → `to` o'zgarganda `focal` nuqta (stage markaziga nisbatan px) ekranda joyida
 * qolishi uchun yangi pan (transform-origin — kitob markazi = stage markazi).
 */
export function zoomAround(
  pan: { x: number; y: number },
  focal: { x: number; y: number },
  from: number,
  to: number,
) {
  if (!(from > 0)) return pan;
  const ratio = to / from;
  return { x: focal.x - (focal.x - pan.x) * ratio, y: focal.y - (focal.y - pan.y) * ratio };
}

/**
 * Varaqlar to'plami qalinligi (qatlamlar soni): umumiy qalinlik kitob hajmiga qarab (2–10), chap
 * tomon — o'qilgan qism. Muqovada chap 0, oxirida o'ng 0.
 */
export function stackDepths(start: number, total: number): { left: number; right: number } {
  const layers = Math.min(10, Math.max(2, Math.round(total / 24)));
  const read = total > 1 ? (start - 1) / (total - 1) : 0;
  const left = Math.round(layers * Math.min(1, Math.max(0, read)));
  return { left, right: layers - left };
}

/**
 * Varaqlar qirrasi: `box-shadow` qatlamlari (har biri 1.5px siljigan qog'oz qirrasi). `side` −1 —
 * chapga, 1 — o'ngga.
 */
export function stackShadow(depth: number, side: -1 | 1): string {
  return Array.from({ length: depth }, (_, index) => {
    const offset = (index + 1) * 1.5;
    const color = index % 2 === 0 ? "var(--book-edge)" : "var(--book-edge-line)";
    return `${side * offset}px ${offset * 0.35}px 0 0 ${color}`;
  }).join(", ");
}

/** Curl o'rniga oddiy crossfade: harakat kamaytirilgan yoki qurilma sust (≤ 2 yadro / ≤ 2 GB). */
export function prefersSimpleFlip({
  reducedMotion,
  cores,
  memory,
}: {
  reducedMotion: boolean;
  cores?: number;
  memory?: number;
}): boolean {
  return (
    reducedMotion || (cores !== undefined && cores <= 2) || (memory !== undefined && memory <= 2)
  );
}

/** Qayta chizish o'lchami: bitta canvas tomoni shu px dan oshmaydi (xotira). */
export const MAX_CANVAS_SIDE = 4096;

/** Canvas piksel zichligi: `devicePixelRatio × zoom`, eng katta tomon ≤ `MAX_CANVAS_SIDE`. */
export function renderPixelRatio(baseRatio: number, zoom: number, cssSize: Size): number {
  const side = Math.max(cssSize.width, cssSize.height, 1);
  return Math.max(0.5, Math.min(baseRatio * Math.max(1, zoom), MAX_CANVAS_SIDE / side));
}
