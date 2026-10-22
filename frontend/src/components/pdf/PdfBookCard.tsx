"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import type { PdfBook } from "@/lib/pdf-books/api";
import { cn } from "@/lib/utils/cn";
import { pdfBookPath } from "@/lib/utils/routes";
import { BookCover } from "./BookCover";

export interface PdfBookCardProps {
  book: PdfBook;
  /** Oxirgi o'qilgan sahifa (bo'lsa "davom etish" belgisi). */
  resumePage?: number;
  /** `column` — katalog gridi (muqova tepada); `row` — tor panellar (muqova chapda). */
  layout?: "column" | "row";
}

/** Katalog kartasi: muqova (3:4), nom, fan va sinf, betlar soni. */
export function PdfBookCard({ book, resumePage, layout = "column" }: PdfBookCardProps) {
  const t = useTranslations("pdfBooks.card");
  const locale = useLocale() as Locale;
  const title = getLocalized(book.title, locale);
  const row = layout === "row";
  return (
    <Link
      href={pdfBookPath(book.id)}
      data-testid="pdf-book-card"
      className={cn(
        "border-border bg-surface group flex h-full gap-3 rounded-xl border p-3 shadow-xs transition-[transform,box-shadow,border-color] duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0",
        "hover:border-primary-300 hover:shadow-md focus-visible:outline-offset-2",
        row ? "flex-row" : "flex-col",
      )}
    >
      <BookCover src={book.cover} className={row ? "w-20" : "w-full"} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="group-hover:text-link line-clamp-2 text-[0.9375rem] leading-snug font-semibold text-balance transition-colors">
          {title}
        </h3>
        <p className="text-muted line-clamp-1 text-sm">
          {t("meta", { grade: book.grade, subject: getLocalized(book.subject_title, locale) })}
        </p>
        <p className="text-muted text-sm tabular-nums">{t("pages", { count: book.page_count })}</p>
        {((resumePage && resumePage > 1) || book.unverified) && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
            {resumePage && resumePage > 1 && (
              <Badge variant="primary">{t("resume", { page: resumePage })}</Badge>
            )}
            {book.unverified && <Badge variant="accent">{t("unverified")}</Badge>}
          </div>
        )}
      </div>
    </Link>
  );
}

/** Yuklanish holati: kartaning o'zi bilan bir xil o'lcham (layout sakramasin). */
export function PdfBookCardSkeleton() {
  return (
    <div className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-3">
      <Skeleton className="aspect-[3/4] w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3.5 w-3/5" />
    </div>
  );
}
