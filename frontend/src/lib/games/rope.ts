/**
 * Arqon tortish: ikki jamoa. Arqon belgisi `position` — 0 markaz, manfiy tomon 0-jamoaga (chap),
 * musbat 1-jamoaga (o'ng). To'g'ri javob arqonni o'z tomoniga bir qadam tortadi.
 */

/** Shuncha qadam tortgan jamoa darhol yutadi. */
export const ROPE_LIMIT = 5;

export function pullRope(position: number, teamIndex: 0 | 1, correct: boolean): number {
  if (!correct) return position;
  const next = position + (teamIndex === 0 ? -1 : 1);
  return Math.max(-ROPE_LIMIT, Math.min(ROPE_LIMIT, next));
}

/** Chegaraga yetgan jamoa (o'yin shu zahoti tugaydi), aks holda `null`. */
export function ropeWinner(position: number, limit = ROPE_LIMIT): 0 | 1 | null {
  if (position <= -limit) return 0;
  if (position >= limit) return 1;
  return null;
}

/** Savollar tugaganda: arqon qaysi tomonda bo'lsa o'sha jamoa; markazda — durang (`null`). */
export function ropeFinalWinner(position: number): 0 | 1 | null {
  if (position < 0) return 0;
  if (position > 0) return 1;
  return null;
}

/** Belgining ekrandagi joyi foizda (0 — chap chekka, 50 — markaz, 100 — o'ng chekka). */
export const ropePercent = (position: number, limit = ROPE_LIMIT) =>
  50 + (Math.max(-limit, Math.min(limit, position)) / limit) * 50;
