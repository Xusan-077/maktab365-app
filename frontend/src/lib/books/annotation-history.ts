import type { Annotation } from "./annotations";

/**
 * Bir betning annotatsiyalari va undo/redo tarixi. Har qadam — betning to'liq ro'yxati (o'zgarmas
 * snapshot): ro'yxatlar kichik va elementlar umumiy ishlatiladi, shuning uchun xotira arzon,
 * mantiq esa oddiy (qisman qaytarish xatosi yo'q).
 */
export interface PageHistory {
  items: readonly Annotation[];
  past: ReadonlyArray<readonly Annotation[]>;
  future: ReadonlyArray<readonly Annotation[]>;
}

export const HISTORY_LIMIT = 100;

export function createHistory(items: readonly Annotation[] = []): PageHistory {
  return { items, past: [], future: [] };
}

/** Yangi holatni qo'yadi (oldingisi tarixga ketadi, "qayta" tarixi tozalanadi). */
export function commitHistory(history: PageHistory, next: readonly Annotation[]): PageHistory {
  if (next === history.items) return history;
  return {
    items: next,
    past: [...history.past.slice(-(HISTORY_LIMIT - 1)), history.items],
    future: [],
  };
}

export const canUndo = (history: PageHistory): boolean => history.past.length > 0;
export const canRedo = (history: PageHistory): boolean => history.future.length > 0;

export function undoHistory(history: PageHistory): PageHistory {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    items: previous,
    past: history.past.slice(0, -1),
    future: [history.items, ...history.future],
  };
}

export function redoHistory(history: PageHistory): PageHistory {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return { items: next, past: [...history.past, history.items], future: rest };
}

/** Serverdan kelgan ro'yxat tarixsiz o'rnatiladi (yuklash undo qadami bo'lmaydi). */
export function replaceItems(history: PageHistory, items: readonly Annotation[]): PageHistory {
  return { ...history, items };
}
