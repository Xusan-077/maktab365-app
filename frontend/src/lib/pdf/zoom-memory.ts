import { commitZoom } from "./zoom";

/** Har kitobning oxirgi zoom'i shu qurilmada (`localStorage`): akkauntga sinxron emas. */
export const ZOOM_MEMORY_KEY = "maktab365-zoom";
/** Shuncha kitobdan ko'pi eslab qolinmaydi (eng eskisi tashlanadi). */
export const ZOOM_MEMORY_LIMIT = 50;

type ZoomMap = Record<string, number>;

function read(storage: Storage): ZoomMap {
  try {
    const raw = JSON.parse(storage.getItem(ZOOM_MEMORY_KEY) ?? "{}") as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const map: ZoomMap = {};
    for (const [id, value] of Object.entries(raw)) {
      if (typeof value === "number" && Number.isFinite(value)) map[id] = commitZoom(value);
    }
    return map;
  } catch {
    return {};
  }
}

/** Kitobning saqlangan zoom'i; yo'q (yoki storage ishlamasa) — `null` («Moslash» bilan ochiladi). */
export function loadBookZoom(bookId: string, storage?: Storage | null): number | null {
  if (!storage) return null;
  return read(storage)[bookId] ?? null;
}

/** Zoom'ni yozadi; ro'yxat oxirida eng yangisi, chegaradan oshsa eng eskilari o'chadi. */
export function saveBookZoom(bookId: string, zoom: number, storage?: Storage | null): void {
  if (!storage) return;
  const map = read(storage);
  delete map[bookId];
  map[bookId] = commitZoom(zoom);
  const ids = Object.keys(map);
  for (const id of ids.slice(0, Math.max(0, ids.length - ZOOM_MEMORY_LIMIT))) delete map[id];
  try {
    storage.setItem(ZOOM_MEMORY_KEY, JSON.stringify(map));
  } catch {
    // To'lgan / bloklangan storage: zoom faqat shu sessiyada qoladi.
  }
}

/** Brauzer `localStorage` (maxfiy oyna, SSR yoki bloklangan bo'lsa — `null`). */
export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
