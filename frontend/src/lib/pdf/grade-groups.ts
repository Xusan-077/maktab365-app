import type { PdfBook } from "@/lib/pdf-books/api";

/** Fan guruhlari (backend `Subject.group`); URL'da `?guruh=` qiymati. */
export const SUBJECT_GROUPS = ["exact", "natural", "language", "social", "arts"] as const;
export type SubjectGroup = (typeof SUBJECT_GROUPS)[number];

/** Tab kaliti: `all` yoki guruh. */
export type GroupFilter = "all" | SubjectGroup;

/** `?guruh=` qiymatlari (o'zbekcha, qisqa) ↔ guruh. */
export const GROUP_URL: Record<SubjectGroup, string> = {
  exact: "aniq",
  natural: "tabiiy",
  language: "tillar",
  social: "ijtimoiy",
  arts: "sanat",
};

export function parseGroupParam(value: string | null | undefined): GroupFilter {
  const found = SUBJECT_GROUPS.find((group) => GROUP_URL[group] === value);
  return found ?? "all";
}

export const groupParam = (filter: GroupFilter): string | undefined =>
  filter === "all" ? undefined : GROUP_URL[filter];

export interface GradeFilters {
  group: GroupFilter;
  q: string;
}

/** Kitob nomi bo'yicha qidiruv: barcha tillardagi nom, katta-kichik harfga e'tiborsiz. */
export function matchesQuery(book: Pick<PdfBook, "title">, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return Object.values(book.title).some((text) => text?.toLocaleLowerCase().includes(needle));
}

export function filterBooks(books: PdfBook[], filters: GradeFilters): PdfBook[] {
  return books.filter(
    (book) =>
      (filters.group === "all" || book.subject_group === filters.group) &&
      matchesQuery(book, filters.q),
  );
}

/** Tablardagi sonlar (qidiruvni hisobga olgan holda, guruh tanlovisiz). */
export function groupCounts(books: PdfBook[], q: string): Record<GroupFilter, number> {
  const matching = books.filter((book) => matchesQuery(book, q));
  const counts = { all: matching.length } as Record<GroupFilter, number>;
  for (const group of SUBJECT_GROUPS) {
    counts[group] = matching.filter((book) => book.subject_group === group).length;
  }
  return counts;
}

export interface GradeStats {
  count: number;
  totalBytes: number;
}

/** Sinf ko'rsatkichlari: faqat haqiqiy ma'lumotdan (soxta raqam yo'q). */
export function gradeStats(books: PdfBook[]): GradeStats {
  return {
    count: books.length,
    totalBytes: books.reduce((sum, book) => sum + book.size_bytes, 0),
  };
}

/** Sinflar bosqichlari: boshlang'ich 1–4, o'rta 5–9, yuqori 10–11. */
export const GRADE_STAGES = [
  { key: "primary", grades: [1, 2, 3, 4] },
  { key: "middle", grades: [5, 6, 7, 8, 9] },
  { key: "high", grades: [10, 11] },
] as const;

/** Sinf yo'li parametri: faqat 1..11 butun son (`"09"`, `"9.5"`, `"abc"` — `null`). */
export function parseGradeParam(value: string): number | null {
  if (!/^[1-9]\d?$/.test(value)) return null;
  const grade = Number(value);
  return grade >= 1 && grade <= 11 ? grade : null;
}
