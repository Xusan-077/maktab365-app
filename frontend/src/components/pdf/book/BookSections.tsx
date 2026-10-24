import { useLocale, useTranslations } from "next-intl";
import { BookCard } from "@/components/site/BookCard";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import type { PdfBook, PdfBookDetail } from "@/lib/pdf-books/api";
import { gradePath, pdfBookPath } from "@/lib/utils/routes";
import { sectionHeading } from "./book-styles";

export { sectionHeading };
export { BookToc } from "./BookToc";

/** "Algebra boshqa sinflarda": shu fanning boshqa sinflardagi kitoblari (sinf raqami plitkalari). */
export function OtherGrades({
  current,
  subjectBooks,
  subjectTitle,
}: {
  current: PdfBookDetail;
  subjectBooks: PdfBook[];
  subjectTitle: string;
}) {
  const t = useTranslations("pdfBooks.page");
  const ts = useTranslations("site");
  const locale = useLocale() as Locale;
  // Bir sinfda bir nechta kitob bo'lsa, birinchisiga havola (sinf bo'yicha tartiblangan).
  const byGrade = new Map<number, PdfBook>();
  for (const book of [...subjectBooks].sort((a, b) => a.grade - b.grade)) {
    if (book.grade !== current.grade && !byGrade.has(book.grade)) byGrade.set(book.grade, book);
  }
  if (byGrade.size === 0) return null;
  return (
    <section aria-labelledby="book-other-grades" className="flex flex-col gap-4">
      <h2 id="book-other-grades" className="text-xl font-extrabold">
        {t("otherGrades", { subject: subjectTitle })}
      </h2>
      <ul className="grid grid-cols-2 gap-2.5">
        {[...byGrade.values()].map((book) => (
          <li key={book.id}>
            <Link
              href={pdfBookPath(book)}
              aria-label={`${getLocalized(book.title, locale)}, ${ts("gradeLabel", { grade: book.grade })}`}
              className="border-border hover:bg-surface-2 flex min-h-11 items-baseline gap-1.5 rounded-[0.875rem] border p-3.5 transition-colors"
            >
              <span className="text-brand-text text-[1.75rem] font-extrabold tracking-[-0.02em]">
                {book.grade}
              </span>
              <span className="text-sm font-semibold">{ts("gradeWord")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Joriysidan tashqari shu sinf kitoblari: shu fan bir xillari birinchi. */
function sameGradeBooks(current: PdfBookDetail, gradeBooks: PdfBook[]): PdfBook[] {
  return gradeBooks
    .filter((book) => book.id !== current.id)
    .sort((a, b) => Number(b.subject === current.subject) - Number(a.subject === current.subject));
}

/** O'ng ustun (md+): shu sinfning boshqa darsliklari — ixcham ro'yxat va katalogga havola. */
export function SameGradeList({
  current,
  gradeBooks,
  limit = 4,
}: {
  current: PdfBookDetail;
  gradeBooks: PdfBook[];
  limit?: number;
}) {
  const t = useTranslations("pdfBooks.page");
  const locale = useLocale() as Locale;
  const books = sameGradeBooks(current, gradeBooks).slice(0, limit);
  if (books.length === 0) return null;
  return (
    <section
      aria-labelledby="book-same-grade"
      data-testid="book-same-grade"
      className="border-border flex flex-col gap-3 rounded-[1.125rem] border p-5"
    >
      <h2 id="book-same-grade" className="text-base font-extrabold">
        {t("sameGrade", { grade: current.grade })}
      </h2>
      <ul className="flex flex-col">
        {books.map((book) => (
          <li key={book.id}>
            <Link
              href={pdfBookPath(book)}
              className="hover:bg-surface-2 -mx-2 flex min-h-11 flex-col justify-center rounded-lg px-2 py-1.5"
            >
              <span className="font-semibold">{getLocalized(book.title, locale)}</span>
              <span className="text-muted text-sm">{getLocalized(book.subject_title, locale)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={gradePath(current.grade)}
        className="text-link text-sm font-semibold hover:underline"
      >
        {t("all")} →
      </Link>
    </section>
  );
}

/** Shu sinfning boshqa kitoblari (joriysidan tashqari, fan bir xillari birinchi) va katalogga havola. */
export function SimilarBooks({
  current,
  gradeBooks,
}: {
  current: PdfBookDetail;
  gradeBooks: PdfBook[];
}) {
  const t = useTranslations("pdfBooks.page");
  const others = sameGradeBooks(current, gradeBooks).slice(0, 6);
  if (others.length === 0) return null;
  return (
    <section aria-labelledby="book-similar" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="book-similar" className={sectionHeading}>
          {t("sameGrade", { grade: current.grade })}
        </h2>
        <Link href={gradePath(current.grade)} className="text-link font-semibold hover:underline">
          {t("all")} →
        </Link>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-5 gap-y-6">
        {others.map((book) => (
          <li key={book.id}>
            <BookCard book={book} sizes="(min-width: 1024px) 190px, 45vw" />
          </li>
        ))}
      </ul>
    </section>
  );
}
