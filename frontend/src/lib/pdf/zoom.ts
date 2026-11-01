/** O'qish oynasi zoom'i (0.5×–4×; sof funksiyalar). */

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4;
/** Sahifa moslangan holat (100%): undan kattasi — kattalashgan (surish, swipe o'chadi). */
export const DEFAULT_ZOOM = 1;
/** "Zoom" tugmasi shu pog'onalar bo'yicha aylanadi. */
export const ZOOM_STEPS = [1, 1.5, 2, 3, 4] as const;
/** Ikki marta bosilganda kattalashish darajasi. */
export const DOUBLE_TAP_ZOOM = 2;
/**
 * Zoom (pinch, g'ildirak, tugma) tugagach shuncha ms davomida bet almashmaydi: kitobda swipe/varaq
 * ag'darish, uzluksiz rejimda «joriy bet» qayta hisoblanmaydi (barmoqlar bir vaqtda ko'tarilmaydi,
 * scroll tuzatishi va betlar o'lchami tinchishi kerak).
 */
export const ZOOM_SETTLE_LOCK_MS = 400;

/**
 * Zoom sezgirligi — **sozlash shu yerda**. G'ildirak/trackpad: har hodisada `zoom × exp(−deltaY × k)`
 * (`deltaY` — px; Firefox qatorlari ×16). `k` kattaroq — tezroq.
 * - `mouseWheel` — sichqoncha g'ildiragi (diskret, ~100 px qadam): 0.0033 → bir qadam ≈ ×1.39.
 * - `trackpad` — trackpad pinch / mayda uzluksiz `deltaY` (Chrome, Edge, Firefox `ctrlKey` bilan):
 *   0.0045 (oldingidan 2×).
 * - `maxDeltaPx` — bitta hodisada ko'pi bilan shuncha px (g'ildirak tez aylantirilganda sakramasin).
 * - `discreteMinPx` — butun va shundan katta `deltaY` sichqoncha qadami deb olinadi.
 */
export const ZOOM_SENSITIVITY = {
  mouseWheel: 0.0033,
  trackpad: 0.0045,
  maxDeltaPx: 160,
  discreteMinPx: 40,
} as const;
/** −/+ tugmasi va klaviatura `+`/`−` qadami (25%). */
export const ZOOM_NUDGE = 0.25;
/** −/+ va pog'ona tugmalari zoom animatsiyasi (ms). */
export const ZOOM_BUTTON_ANIMATION_MS = 180;
/** G'ildirak/trackpad to'xtagach shuncha ms dan keyin zoom holatga yoziladi va betlar qayta chiziladi. */
export const ZOOM_COMMIT_DEBOUNCE_MS = 150;

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

/** −/+ : eng yaqin `ZOOM_NUDGE` (25%) pog'onasiga, chegaralar ichida. */
export function nudgeZoom(zoom: number, direction: 1 | -1): number {
  // Oraliq qiymatdan (masalan 1.3 dan +) — keyingi pog'onaga (1.5), keyingidan keyingisiga emas.
  const position = zoom / ZOOM_NUDGE;
  const steps = direction > 0 ? Math.floor(position + 1e-6) + 1 : Math.ceil(position - 1e-6) - 1;
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

/** Sichqoncha g'ildiragi (diskret qadam) mi yoki trackpad (mayda uzluksiz `deltaY`). */
export function isDiscreteWheel(deltaY: number, deltaMode = 0): boolean {
  if (deltaMode !== 0) return true;
  const size = Math.abs(deltaY);
  return size >= ZOOM_SENSITIVITY.discreteMinPx && Number.isInteger(size);
}

/**
 * Ctrl+g'ildirak / trackpad pinch: `deltaY` ga mutanosib uzluksiz ko'paytma `exp(−deltaY × k)`;
 * `k` — sichqoncha yoki trackpad (`ZOOM_SENSITIVITY`). `deltaMode` qatorlarda (Firefox) — px ga.
 */
export function wheelZoomSmooth(zoom: number, deltaY: number, deltaMode = 0): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  const limit = ZOOM_SENSITIVITY.maxDeltaPx;
  const clamped = Math.max(-limit, Math.min(limit, pixels));
  const k = isDiscreteWheel(deltaY, deltaMode)
    ? ZOOM_SENSITIVITY.mouseWheel
    : ZOOM_SENSITIVITY.trackpad;
  return zoom * Math.exp(-clamped * k);
}

/**
 * Gesture (pinch / g'ildirak) tugagach holatga yoziladigan qiymat: chegaralar ichida, 0.01 ga
 * yaxlitlangan. 0.05 qadam bu yerda ishlatilmaydi — qo'yib yuborilganda ko'rinish sakramasin.
 */
export function commitZoom(value: number): number {
  return clampZoomSmooth(Math.round(clampZoomSmooth(value) * 100) / 100);
}
