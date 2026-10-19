import type { ExerciseStatus, ReadStatus } from "@/types/progress";

export const READ_RANK: Record<ReadStatus, number> = { none: 0, started: 1, completed: 2 };
export const EXERCISE_RANK: Record<ExerciseStatus, number> = {
  none: 0,
  in_progress: 1,
  completed: 2,
};

/** Deyarli oxirigacha aylantirilgan mavzu "o'qilgan" hisoblanadi. */
export const READ_COMPLETED_SCROLL = 0.97;

/** Ikki holatdan yuqorisini tanlaydi; biri yo'q bo'lsa ikkinchisi. */
export function maxBy<T extends string>(
  rank: Record<T, number>,
  a: T | undefined,
  b: T | undefined,
) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return rank[a] >= rank[b] ? a : b;
}

/** Aylantirilgan joyga mos o'qish holati; mavjud holatdan pastga tushmaydi. */
export function nextReadStatus(existing: ReadStatus | undefined, scroll: number): ReadStatus {
  const reached: ReadStatus = scroll >= READ_COMPLETED_SCROLL ? "completed" : "started";
  return maxBy(READ_RANK, existing, reached) ?? reached;
}

/** Urinishlar hisobini birlashtiradi: har mashq uchun eng kattasi. */
export function mergeAttempts(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
): Record<string, number> {
  const result = { ...a };
  for (const [id, count] of Object.entries(b ?? {})) result[id] = Math.max(result[id] ?? 0, count);
  return result;
}
