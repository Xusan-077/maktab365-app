import type { Progress } from "@/types/progress";

/** Mavzu o'zlashtirilishi: xatosiz bajarilgan / xato bor / hali tugamagan. */
export type Mastery = "mastered" | "review" | "inProgress";

export type ResultGroups = Record<Mastery, Progress[]>;

/** Mavzu bo'yicha biror harakat bo'lganmi (bo'sh yozuvlar natijaga kirmaydi). */
export const hasActivity = (item: Progress) =>
  item.readStatus !== "none" || item.exerciseStatus !== "none" || item.mistakes.length > 0;

/** Mavzu to'liq tugagan: o'qilgan, mashqlardan o'tilgan va xato qolmagan. */
export const isFinished = (item: Progress) =>
  item.readStatus === "completed" && item.exerciseStatus === "completed";

/** "Takrorlash kerak": mashqlarda xato qilingan (`mistakes[]` bo'sh emas) mavzu. Yagona manba shu. */
export const needsReview = (item: Pick<Progress, "mistakes">) => item.mistakes.length > 0;

/** Takrorlash kerak mavzular: eng ko'p xato qilingani, teng bo'lsa eng yangisi birinchi. */
export function reviewTopics(items: Progress[]): Progress[] {
  return items
    .filter(needsReview)
    .sort(
      (a, b) => b.mistakes.length - a.mistakes.length || b.updatedAt.localeCompare(a.updatedAt),
    );
}

export function masteryOf(item: Progress): Mastery {
  if (needsReview(item)) return "review";
  return item.exerciseStatus === "completed" ? "mastered" : "inProgress";
}

const byRecent = (a: Progress, b: Progress) => b.updatedAt.localeCompare(a.updatedAt);

/** Mavzularni o'zlashtirilishi bo'yicha guruhlaydi; har guruhda eng yangisi birinchi. */
export function groupByMastery(items: Progress[]): ResultGroups {
  const groups: ResultGroups = { mastered: [], review: [], inProgress: [] };
  for (const item of [...items].sort(byRecent)) {
    if (hasActivity(item)) groups[masteryOf(item)].push(item);
  }
  return groups;
}

/** Davom ettirish kartochkasi uchun: eng oxirgi boshlangan, hali tugamagan mavzu. */
export function pickContinue(items: Progress[]): Progress | undefined {
  return [...items]
    .sort(byRecent)
    .find((item) => hasActivity(item) && !(isFinished(item) && item.mistakes.length === 0));
}
