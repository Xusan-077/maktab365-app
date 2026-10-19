type BookLike = { subjectId: string; grade: number };

export interface TeacherFilterSelection {
  /** Tanlangan fan id'lari; bo'sh — fan bo'yicha cheklov yo'q. */
  subjects: string[];
  /** Tanlangan sinflar; bo'sh — sinf bo'yicha cheklov yo'q. */
  grades: number[];
}

/**
 * Filtr tanlovi: foydalanuvchi hali o'zgartirmagan (`null`) bo'lsa, profildagi fan va sinflar ishlatiladi.
 */
export function effectiveSelection(
  chosen: { subjects: string[] | null; grades: number[] | null },
  profile: { subjects?: string[]; grades?: number[] },
): TeacherFilterSelection {
  return {
    subjects: chosen.subjects ?? profile.subjects ?? [],
    grades: chosen.grades ?? profile.grades ?? [],
  };
}

export const matchesBook = (book: BookLike, sel: TeacherFilterSelection) =>
  (sel.subjects.length === 0 || sel.subjects.includes(book.subjectId)) &&
  (sel.grades.length === 0 || sel.grades.includes(book.grade));

/** Tanlovga mos kitoblar. */
export const filterBooks = <T extends BookLike>(books: T[], sel: TeacherFilterSelection): T[] =>
  books.filter((book) => matchesBook(book, sel));

/** Ro'yxatdagi qiymatni qo'shadi yoki olib tashlaydi. */
export const toggleValue = <T>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
