import { array, mixed, number, object, string, type InferType } from "yup";
import type { AdminBook, AdminBookInput, AdminBookType } from "@/lib/library/admin-api";
import type { BookLanguage } from "@/lib/books/api";
import { BOOK_LANGUAGES, BOOK_TYPES } from "@/lib/books/filters";

export const TITLE_MAX = 255;
export const AUTHOR_MAX = 255;
export const DESCRIPTION_MAX = 4000;

/**
 * Kutubxona kitobi formasi. Xabar kalitlari — `admin.library.form.*`. Sinf matn sifatida
 * ("" — sinfsiz), chunki tanlagich qiymati satr.
 */
export const libraryBookSchema = object({
  title: string().trim().required("titleRequired").max(TITLE_MAX, "titleTooLong"),
  author: string().trim().max(AUTHOR_MAX, "authorTooLong").default(""),
  type: mixed<AdminBookType>()
    .oneOf([...BOOK_TYPES])
    .required(),
  grade: string().default(""),
  language: mixed<BookLanguage>()
    .oneOf([...BOOK_LANGUAGES])
    .required(),
  description: string().trim().max(DESCRIPTION_MAX, "descriptionTooLong").default(""),
  chapters: array(
    object({
      title: string().trim().required("chapterTitleRequired").max(200, "chapterTitleTooLong"),
      page: number()
        .typeError("chapterPageInvalid")
        .integer("chapterPageInvalid")
        .min(1, "chapterPageInvalid")
        .required("chapterPageInvalid"),
    }),
  ).default([]),
});

export type LibraryBookValues = InferType<typeof libraryBookSchema>;

export const EMPTY_LIBRARY_BOOK: LibraryBookValues = {
  title: "",
  author: "",
  type: "other",
  grade: "",
  language: "uz",
  description: "",
  chapters: [],
};

export function toFormValues(book: AdminBook): LibraryBookValues {
  return {
    title: book.title,
    author: book.author ?? "",
    type: book.type ?? "other",
    grade: book.grade_level ? String(book.grade_level) : "",
    language: book.language ?? "uz",
    description: book.description ?? "",
    chapters: (book.chapters ?? []).map((row) => ({ title: row.title, page: row.start_page })),
  };
}

export function toPayload(values: LibraryBookValues): AdminBookInput {
  return {
    title: values.title.trim(),
    author: values.author.trim(),
    type: values.type,
    grade_level: values.grade ? Number(values.grade) : null,
    language: values.language,
    description: values.description.trim(),
    chapters: values.chapters.map((row) => ({ title: row.title.trim(), start_page: row.page })),
  };
}
