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
