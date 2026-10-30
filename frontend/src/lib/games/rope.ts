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

/** Umumiy vaqt (3:00) va oxirgi shuncha soniyada taymer qizil. */
export const ROPE_SECONDS = 180;
export const ROPE_WARNING_SECONDS = 30;
/** Oxirgi shuncha soniyada har soniyada signal. */
export const ROPE_BEEP_SECONDS = 10;
/** Xato javobdan keyin jamoa shuncha bloklanadi. */
export const ROPE_BLOCK_MS = 1500;

/** Pozitsiya ko'rsatkichi nuqtalari: −LIMIT…+LIMIT (11 ta). */
export const ropeDots = (limit = ROPE_LIMIT) =>
  Array.from({ length: limit * 2 + 1 }, (_, index) => index - limit);

/**
 * Har jamoaning o'z savollari: 0-jamoa — juft, 1-jamoa — toq indekslar. `cursor` — jamoa nechanchi
 * savolda; savollar tugasa jamoa o'z savollarini boshidan aylanadi (vaqt tugaguncha).
 */
export function ropeQuestionIndex(team: 0 | 1, cursor: number, questionCount: number): number {
  const own = team === 0 ? Math.ceil(questionCount / 2) : Math.floor(questionCount / 2);
  if (own === 0) return 0;
  return (cursor % own) * 2 + team;
}
