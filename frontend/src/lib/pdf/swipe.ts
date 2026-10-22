export type SwipeDirection = "next" | "prev";

/** Gorizontal harakat shuncha pikseldan oshsa swipe hisoblanadi. */
export const SWIPE_MIN_DISTANCE = 60;
/** Gorizontal harakat vertikalidan shuncha marta ko'p bo'lishi kerak (tikka scroll swipe emas). */
export const SWIPE_DOMINANCE = 1.5;
/** Juda sekin harakat (ushlab turish) swipe emas. */
export const SWIPE_MAX_DURATION_MS = 800;

/** Barmoq chapga surilsa — keyingi sahifa, o'ngga — oldingi. */
export function swipeDirection(dx: number, dy: number, durationMs: number): SwipeDirection | null {
  if (durationMs > SWIPE_MAX_DURATION_MS) return null;
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return null;
  if (Math.abs(dx) < Math.abs(dy) * SWIPE_DOMINANCE) return null;
  return dx < 0 ? "next" : "prev";
}
