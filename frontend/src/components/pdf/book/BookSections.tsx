import { ChevronRight, Presentation } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { BookCard } from "@/components/site/BookCard";
import { Badge } from "@/components/ui/Badge";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { flattenToc } from "@/lib/pdf/toc";
import type { PdfBook, PdfBookDetail } from "@/lib/pdf-books/api";
import { cn } from "@/lib/utils/cn";
import { gradePath, pdfBookPath, readerPath } from "@/lib/utils/routes";

export const sectionHeading = "text-[1.625rem] font-extrabold tracking-[-0.02em]";

/** Mundarija: har qator o'qish oynasida shu betga ochadi; prezentatsiyasi borlarga belgi. */
export function BookToc({ book }: { book: PdfBookDetail }) {
  const t = useTranslations("pdfBooks.page");
  const items = flattenToc(book.chapters ?? []);
  if (items.length === 0) return null;
  let top = 0;
  return (
    <section aria-labelledby="book-toc" className="flex min-w-0 flex-col gap-4">
      <h2 id="book-toc" className={sectionHeading}>
        {t("toc")}
      </h2>
      <ol
        data-testid="book-toc"
        className="border-border divide-border overflow-hidden rounded-[1.125rem] border"
      >
        {items.map((item) => {
          const number = item.level === 0 ? ++top : null;
          return (
            <li key={item.id}>
              <Link
                href={readerPath(book, item.page)}
                className={cn(
                  "hover:bg-surface-2 flex min-h-11 items-center gap-4 px-5 py-3.5 transition-colors",
                  item.level === 1 && "pl-14",
                  item.id !== items[0].id && "border-border border-t",
                )}
              >
                {number !== null ? (
                  <span
                    aria-hidden
                    className="bg-surface-2 text-brand-text flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] text-[0.9375rem] font-extrabold"
                  >
                    {number}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "min-w-0 flex-1 text-base",
                    item.level === 0 ? "font-semibold" : "text-muted",
                  )}
                >
                  {item.title}
                </span>
                {item.slides && (
                  <Badge variant="accent" className="shrink-0 gap-1">
                    <Presentation className="size-3" aria-hidden />
                    {t("tocPresentation")}
                  </Badge>
                )}
                <span className="text-muted shrink-0 text-sm tabular-nums">
                  {t("tocPage", { page: item.page })}
                </span>
                <ChevronRight className="text-faint size-[1.125rem] shrink-0" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

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

/** Shu sinfning boshqa kitoblari (joriysidan tashqari, fan bir xillari birinchi) va katalogga havola. */
export function SimilarBooks({
  current,
  gradeBooks,
}: {
  current: PdfBookDetail;
  gradeBooks: PdfBook[];
}) {
  const t = useTranslations("pdfBooks.page");
  const others = gradeBooks
    .filter((book) => book.id !== current.id)
    .sort((a, b) => Number(b.subject === current.subject) - Number(a.subject === current.subject))
    .slice(0, 6);
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
