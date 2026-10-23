import { Presentation } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n/config";
import { Link } from "@/lib/i18n/navigation";
import { flattenToc } from "@/lib/pdf/toc";
import type { PdfBook, PdfBookDetail } from "@/lib/pdf-books/api";
import { formatBytes } from "@/lib/utils/bytes";
import { cn } from "@/lib/utils/cn";
import { gradePath, readerPath } from "@/lib/utils/routes";
import { PdfBookCard } from "../PdfBookCard";

/** Kitob pasporti: faqat haqiqiy maydonlar (narx — platforma bepul). */
export function BookPassport({
  book,
  subjectTitle,
}: {
  book: PdfBookDetail;
  subjectTitle: string;
}) {
  const t = useTranslations("pdfBooks.page.passport");
  const locale = useLocale() as Locale;
  const language = (book.language ?? "uz") as "uz" | "ru" | "en";
  const rows: [string, string][] = [
    [t("grade"), t("gradeValue", { grade: book.grade })],
    [t("subject"), subjectTitle],
    [t("format"), "PDF"],
    ...(book.size_bytes > 0 ? [[t("size"), formatBytes(book.size_bytes)] as [string, string]] : []),
    [t("pages"), t("pagesValue", { count: book.page_count })],
    [t("language"), t(`languages.${language}`)],
    ...(book.published_at
      ? [
          [
            t("added"),
            new Date(book.published_at).toLocaleDateString(locale, {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
          ] as [string, string],
        ]
      : []),
    [t("price"), t("free")],
  ];
  return (
    <section aria-labelledby="book-passport" className="flex flex-col gap-3">
      <h2 id="book-passport" className="text-xl font-semibold tracking-tight">
        {t("title")}
      </h2>
      <dl
        data-testid="book-passport"
        className="border-border bg-surface divide-border divide-y rounded-xl border"
      >
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-4 py-2.5"
          >
            <dt className="text-muted text-sm">{label}</dt>
            <dd className="text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Mundarija: har qator o'qish oynasida shu betga ochadi; prezentatsiyasi borlarga belgi. */
export function BookToc({ book }: { book: PdfBookDetail }) {
  const t = useTranslations("pdfBooks.page");
  const items = flattenToc(book.chapters ?? []);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="book-toc" className="flex flex-col gap-3">
      <h2 id="book-toc" className="text-xl font-semibold tracking-tight">
        {t("toc")}
      </h2>
      <ol
        data-testid="book-toc"
        className="border-border bg-surface divide-border divide-y rounded-xl border"
      >
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={readerPath(book, item.page)}
              className={cn(
                "hover:bg-subtle flex min-h-11 items-center gap-3 px-4 py-2 text-sm",
                item.level === 1 && "pl-9",
              )}
            >
              <span className={cn("min-w-0 flex-1", item.level === 0 && "font-medium")}>
                {item.title}
              </span>
              {item.slides && (
                <Badge variant="accent" className="shrink-0 gap-1">
                  <Presentation className="size-3" aria-hidden />
                  {t("tocPresentation")}
                </Badge>
              )}
              <span className="text-muted shrink-0 tabular-nums">
                {t("tocPage", { page: item.page })}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Shu sinfning boshqa kitoblari (joriysidan tashqari, fan bir xillari birinchi) va sinfga havola. */
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
    .slice(0, 4);
  return (
    <section aria-labelledby="book-similar" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="book-similar" className="text-xl font-semibold tracking-tight">
          {t("similar")}
        </h2>
        <Link
          href={gradePath(current.grade)}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          {t("allOfGrade", { grade: current.grade })}
        </Link>
      </div>
      {others.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4">
          {others.map((book) => (
            <li key={book.id}>
              <PdfBookCard book={book} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
