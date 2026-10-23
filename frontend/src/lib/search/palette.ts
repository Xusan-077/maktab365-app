import type { PdfSubject } from "@/lib/pdf-books/api";
import { GRADES } from "@/types/catalog";

const GRADE_QUERY = /^(\d{1,2})\s*-?\s*(?:sinf|класс|клас|grade|sinfi)?$/iu;

/**
 * "9", "9-sinf", "9 класс", "grade 9", "1" (→ 1, 10, 11) kabi so'rovlarga mos sinflar. Raqamli
 * boshlanish bo'yicha: "1" hamma "1…" sinflarni beradi; aniq moslik birinchi.
 */
export function matchGrades(query: string): number[] {
  const text = query
    .trim()
    .toLocaleLowerCase()
    .replace(/^grade\s+/u, "");
  const match = GRADE_QUERY.exec(text);
  if (!match) return [];
  const digits = match[1];
  if (digits.startsWith("0")) return [];
  const hits = GRADES.filter((grade) => String(grade).startsWith(digits));
  return [...hits].sort((a, b) => Number(String(b) === digits) - Number(String(a) === digits));
}

/** Fan nomi (barcha tillarda) so'rovni o'z ichiga olsa mos. */
export function matchSubjects(subjects: PdfSubject[], query: string): PdfSubject[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length < 2) return [];
  return subjects.filter((subject) =>
    Object.values(subject.title).some((text) => text?.toLocaleLowerCase().includes(needle)),
  );
}
