/** O'qish oynasi zoom'i (0.5×–4×; sof funksiyalar). */

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4;
/** Sahifa moslangan holat (100%): undan kattasi — kattalashgan (surish, swipe o'chadi). */
export const DEFAULT_ZOOM = 1;
/** "Zoom" tugmasi shu pog'onalar bo'yicha aylanadi. */
export const ZOOM_STEPS = [1, 1.5, 2, 3, 4] as const;
/** Ikki marta bosilganda kattalashish darajasi. */
export const DOUBLE_TAP_ZOOM = 2;

/** 0.5..4 oralig'iga va 0.05 qadamga keltiradi (sahifa kengligi tez-tez qayta chizilmasin). */
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

/** −/+ (Aa menyusi, zoom guruhi, klaviatura `+`/`−`) qadami: 10%. */
export const ZOOM_NUDGE = 0.1;

/** −/+ : eng yaqin 10% pog'onasiga, chegaralar ichida. */
export function nudgeZoom(zoom: number, direction: 1 | -1): number {
  const steps = Math.round(zoom / ZOOM_NUDGE) + direction;
  return clampZoom(steps * ZOOM_NUDGE);
}

/**
 * Qadamsiz (uzluksiz) zoom: g'ildirak va pinch paytida har kichik o'zgarish to'planishi uchun
 * 0.05 ga yaxlitlanmaydi (aks holda trackpad'ning mayda `deltaY` qiymatlari zoom'ni qotirib qo'yadi).
 */
export function clampZoomSmooth(value: number, min = MIN_ZOOM, max = MAX_ZOOM): number {
  if (!Number.isFinite(value)) return DEFAULT_ZOOM;
  return Math.min(max, Math.max(min, value));
}

/** Ctrl+g'ildirak: `deltaMode` qatorlarda (Firefox) bo'lsa pikselga keltiriladi; uzluksiz ko'paytma. */
export function wheelZoomSmooth(zoom: number, deltaY: number, deltaMode = 0): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return zoom * Math.exp(-pixels * 0.0022);
}

/**
 * Gesture (pinch / g'ildirak) tugagach holatga yoziladigan qiymat: chegaralar ichida, 0.01 ga
 * yaxlitlangan. 0.05 qadam bu yerda ishlatilmaydi — qo'yib yuborilganda ko'rinish sakramasin.
 */
export function commitZoom(value: number): number {
  return clampZoomSmooth(Math.round(clampZoomSmooth(value) * 100) / 100);
}
