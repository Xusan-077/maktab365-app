/** Fan guruhlari (backend `Subject.group`); URL'da `?guruh=` qiymati. */
export const SUBJECT_GROUPS = ["exact", "natural", "language", "social", "arts"] as const;
export type SubjectGroup = (typeof SUBJECT_GROUPS)[number];

/** `?guruh=` qiymatlari (o'zbekcha, qisqa) ↔ guruh. */
export const GROUP_URL: Record<SubjectGroup, string> = {
  exact: "aniq",
  natural: "tabiiy",
  language: "tillar",
  social: "ijtimoiy",
  arts: "sanat",
};

/** Sinf yo'li parametri: faqat 1..11 butun son (`"09"`, `"9.5"`, `"abc"` — `null`). */
export function parseGradeParam(value: string): number | null {
  if (!/^[1-9]\d?$/.test(value)) return null;
  const grade = Number(value);
  return grade >= 1 && grade <= 11 ? grade : null;
}

/** Sinf → nashr qilingan kitoblar soni (bosh sahifa sinf kartalari); kitobsiz sinf kalitda yo'q. */
export function countBooksByGrade(books: readonly { grade: number }[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const { grade } of books) counts[grade] = (counts[grade] ?? 0) + 1;
  return counts;
}

/** Yo'nalishning kitobi bor fanlari (`order` bo'yicha): soni ham, tavsifdagi nomlar ham shulardan. */
export function groupSubjects<T extends { group: string; order: number; books_count: number }>(
  subjects: readonly T[],
  group: SubjectGroup,
): T[] {
  return subjects
    .filter((subject) => subject.group === group && subject.books_count > 0)
    .sort((a, b) => a.order - b.order);
}
