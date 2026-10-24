/** O'qish oynasi zoom'i (0.5×–3×) va asboblar panelining sig'imi (sof funksiyalar). */

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
/** Sahifa moslangan holat (100%): undan kattasi — kattalashgan (surish, swipe o'chadi). */
export const DEFAULT_ZOOM = 1;
/** "Zoom" tugmasi shu pog'onalar bo'yicha aylanadi. */
export const ZOOM_STEPS = [1, 1.5, 2, 3] as const;
/** Ikki marta bosilganda kattalashish darajasi. */
export const DOUBLE_TAP_ZOOM = 2;

/** 0.5..3 oralig'iga va 0.05 qadamga keltiradi (sahifa kengligi tez-tez qayta chizilmasin). */
export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ZOOM;
  const stepped = Math.round(value * 20) / 20;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, stepped));
}

/** Pinch: boshlanishdagi zoom × (hozirgi / boshlang'ich barmoqlar oralig'i). */
export function pinchZoom(startZoom: number, startDistance: number, distance: number): number {
  if (startDistance <= 0) return clampZoom(startZoom);
  return clampZoom((startZoom * distance) / startDistance);
}

export const doubleTapZoom = (zoom: number) =>
  zoom !== DEFAULT_ZOOM ? DEFAULT_ZOOM : DOUBLE_TAP_ZOOM;

/** Ctrl+g'ildirak (va trackpad pinch'i): `deltaY` < 0 — kattalashtirish, silliq ko'paytma. */
export function wheelZoom(zoom: number, deltaY: number): number {
  return clampZoom(zoom * Math.exp(-deltaY * 0.002));
}

/** Keyingi pog'ona (oraliq qiymatdan — undan kattasi); oxiridan keyin — 1×. */
export function nextZoomStep(zoom: number): number {
  return ZOOM_STEPS.find((step) => step > zoom + 0.01) ?? DEFAULT_ZOOM;
}

export const formatZoom = (zoom: number) => `${Math.round(zoom * 100)}%`;

/**
 * Zoom `ratio` marta o'zgarganda scroll: fokus nuqtasi (konteyner boshidan `focal` px) ekranda
 * joyida qolishi uchun yangi `offset`. Manfiy bo'lmaydi (yuqori chegarani brauzer o'zi qirqadi).
 */
export function anchorOffset(offset: number, focal: number, ratio: number): number {
  return Math.max(0, (offset + focal) * ratio - focal);
}

/**
 * Bir xil kenglikdagi tugmalardan nechtasi qatorga sig'adi: hammasi sig'sa — hammasi, aks holda
 * "⋯" tugmasiga joy qoldiriladi (qolganlari menyuga tushadi).
 */
export function visibleCount(total: number, available: number, itemWidth: number): number {
  if (total <= 0) return 0;
  if (total * itemWidth <= available) return total;
  return Math.max(0, Math.min(total - 1, Math.floor((available - itemWidth) / itemWidth)));
}
