"use client";

import { useLocale, useTranslations } from "next-intl";
import { BookCover } from "@/components/pdf/BookCover";
import { buttonVariants } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import type { PdfLibraryItem } from "@/lib/pdf-books/api";
import { pdfBookPath } from "@/lib/utils/routes";

/** Oxirgi ochilgan darslik: nom, fan va sinf, joriy bet va "Davom ettirish" (shu betga olib boradi). */
export function ContinueCard({ item }: { item: PdfLibraryItem }) {
  const t = useTranslations("library.continue");
  const tc = useTranslations("pdfBooks.card");
  const locale = useLocale() as Locale;
  const { book } = item;
  const title = getLocalized(book.title, locale);

  return (
    <section
      aria-labelledby="continue-title"
      data-testid="continue-card"
      className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-6 sm:flex-row"
    >
      <BookCover
        grade={book.grade}
        subject={book.subject}
        subjectTitle={getLocalized(book.subject_title, locale)}
        src={book.cover}
        className="w-28"
      />
      <div className="flex min-w-0 flex-col items-start gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 id="continue-title" className="text-2xl font-semibold tracking-tight text-balance">
            {title}
          </h2>
          <p className="text-muted">
            {tc("meta", { grade: book.grade, subject: getLocalized(book.subject_title, locale) })}
          </p>
          <p className="text-muted tabular-nums">
            {t("position", { page: item.last_page, total: book.page_count })}
          </p>
        </div>
        <Link
          href={`${pdfBookPath(book.id)}?page=${item.last_page}`}
          aria-label={t("actionLabel", { title })}
          className={buttonVariants({ size: "lg" })}
        >
          {t("action")}
        </Link>
      </div>
    </section>
  );
}
