/** Matn qatlamida belgilangan matn: bet qutisiga nisbatan rect'lar (belgilash uchun) va menyu joyi. */

import type { AnnotationRect } from "./annotations";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Bir belgida shundan ko'p qator bo'lmaydi (juda uzun belgilash ham saqlanadigan hajmda qolsin). */
export const MAX_SELECTION_RECTS = 24;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Brauzer `Range.getClientRects()` → bet qutisiga nisbatan 0..1 rect'lar. Bo'sh va qutidan
 * tashqaridagilar tashlanadi; bir qatordagi (bir xil balandlikdagi, tutash) bo'laklar birlashadi.
 */
export function selectionRects(rects: readonly Box[], box: Box): AnnotationRect[] {
  if (box.width <= 0 || box.height <= 0) return [];
  const result: AnnotationRect[] = [];
  for (const rect of rects) {
    if (rect.width < 1 || rect.height < 1) continue;
    const x = clamp01((rect.left - box.left) / box.width);
    const y = clamp01((rect.top - box.top) / box.height);
    const right = clamp01((rect.left + rect.width - box.left) / box.width);
    const bottom = clamp01((rect.top + rect.height - box.top) / box.height);
    if (right <= x || bottom <= y) continue;
    const last = result.at(-1);
    const sameLine =
      last && Math.abs(last.y - y) < 0.004 && Math.abs(last.h - (bottom - y)) < 0.006;
    if (last && sameLine && x <= last.x + last.w + 0.01) {
      last.w = Math.max(last.x + last.w, right) - last.x;
      continue;
    }
    result.push({ x, y, w: right - x, h: bottom - y });
    if (result.length >= MAX_SELECTION_RECTS) break;
  }
  return result;
}

/** Menyu joyi (fixed, px): belgilash ustida, joy bo'lmasa ostida; ekran chetidan chiqmaydi. */
export function menuPosition(
  selection: Box,
  viewport: { width: number; height: number },
  menu: { width: number; height: number; gap: number; minTop: number },
): { top: number; left: number } {
  const above = selection.top - menu.height - menu.gap;
  const top =
    above >= menu.minTop
      ? above
      : Math.min(selection.top + selection.height + menu.gap, viewport.height - menu.height - 8);
  const center = selection.left + selection.width / 2;
  const left = Math.min(Math.max(8, center - menu.width / 2), viewport.width - menu.width - 8);
  return { top, left };
}
