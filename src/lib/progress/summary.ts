import type { Progress } from "@/types/progress";
import { hasActivity, isFinished } from "./review";

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface WeeklySummary {
  /** O'qilgan va mashqlari ham bajarilgan mavzular. */
  finished: number;
  read: number;
  exercisesPassed: number;
  /** Xato qilingan mashqlar soni. */
  mistakes: number;
  /** Shu davrda biror harakat bo'lgan mavzular soni. */
  active: number;
}

/** Oxirgi 7 kunda yangilangan mavzular bo'yicha hisob. */
export function weeklySummary(items: Progress[], now: Date): WeeklySummary {
  const since = new Date(now.getTime() - WEEK_MS).toISOString();
  const recent = items.filter((item) => hasActivity(item) && item.updatedAt >= since);
  return {
    finished: recent.filter(isFinished).length,
    read: recent.filter((item) => item.readStatus === "completed").length,
    exercisesPassed: recent.filter((item) => item.exerciseStatus === "completed").length,
    mistakes: recent.reduce((sum, item) => sum + item.mistakes.length, 0),
    active: recent.length,
  };
}
