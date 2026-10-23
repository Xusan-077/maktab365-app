import { GRADES } from "@/types/catalog";

/** Tezkor tanlov: boshlang'ich, o'rta, yuqori sinflar. */
export const GRADE_PRESETS = {
  all: GRADES as readonly number[],
  primary: [1, 2, 3, 4],
  middle: [5, 6, 7, 8, 9],
  high: [10, 11],
} as const;

/** Tartiblangan, takrorsiz sinflar ro'yxati. */
export function normalizeGrades(grades: readonly number[]): number[] {
  return [...new Set(grades)].sort((a, b) => a - b);
}

/** `[1,2,3,4,7,9]` → `"1–4, 7, 9"` (ketma-ket 3+ sinf oraliq bo'ladi; ikkitasi alohida: `"5, 6"`). */
export function formatGrades(grades: readonly number[]): string {
  const sorted = normalizeGrades(grades);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i >= 2) parts.push(`${sorted[i]}–${sorted[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(sorted[k]));
    i = j + 1;
  }
  return parts.join(", ");
}

/** `5–11`, `1-4, 7` kabi matnni sinflar ro'yxatiga o'giradi (1..11 dan tashqarisi tashlanadi). */
export function parseGradeRange(text: string): number[] {
  const result: number[] = [];
  for (const part of text.split(/[,;\s]+/).filter(Boolean)) {
    const match = /^(\d{1,2})(?:[-–—](\d{1,2}))?$/.exec(part);
    if (!match) continue;
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);
    for (let g = Math.min(from, to); g <= Math.max(from, to); g++) {
      if (g >= 1 && g <= 11) result.push(g);
    }
  }
  return normalizeGrades(result);
}

export const subjectHasGrade = (subject: { grades?: readonly number[] }, grade: number): boolean =>
  (subject.grades ?? []).includes(grade);
