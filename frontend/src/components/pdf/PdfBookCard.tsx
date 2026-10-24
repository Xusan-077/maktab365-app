"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import type { RecentBook } from "@/lib/pdf/recent";
import { formatBytes } from "@/lib/utils/bytes";
import { cn } from "@/lib/utils/cn";
import { pdfBookPath } from "@/lib/utils/routes";
import { BookCover } from "./BookCover";

export interface PdfBookCardProps {
  book: RecentBook;
  /** Oxirgi o'qilgan sahifa (bo'lsa "davom etish" belgisi va progress chizig'i). */
  resumePage?: number;
  /** Kitob oxirigacha o'qilgan ("O'qilgan" belgisi). */
  read?: boolean;
  /** `column` — katalog gridi (muqova tepada); `row` — tor panellar (muqova chapda). */
  layout?: "column" | "row";
  /** Birinchi ekrandagi karta: muqova rasmi darrov yuklanadi. */
  priority?: boolean;
}

/** Oxirgi sahifaning kitobdagi ulushi (0..1). */
export function readFraction(resumePage: number | undefined, pageCount: number, read: boolean) {
  if (read) return 1;
  if (!resumePage || pageCount <= 0) return 0;
  return Math.min(1, Math.max(0, resumePage / pageCount));
}

/** Katalog kartasi: muqova (3:4), nom, fan va sinf, hajm va betlar, o'qish holati. */
export function PdfBookCard({
  book,
  resumePage,
  read = false,
  layout = "column",
  priority = false,
}: PdfBookCardProps) {
  const t = useTranslations("pdfBooks.card");
  const locale = useLocale() as Locale;
  const title = getLocalized(book.title, locale);
  const subjectTitle = getLocalized(book.subject_title, locale);
  const row = layout === "row";
  const resuming = !read && resumePage !== undefined && resumePage > 1;
  const fraction = readFraction(resumePage, book.page_count, read);
  const info =
    book.size_bytes > 0
      ? t("info", { size: formatBytes(book.size_bytes), pages: book.page_count })
      : t("pages", { count: book.page_count });

  return (
    <Link
      href={pdfBookPath(book)}
      data-testid="pdf-book-card"
      className={cn(
        "group flex h-full gap-3.5 rounded-xl focus-visible:outline-offset-4",
        row ? "flex-row items-start" : "flex-col",
      )}
    >
      <div className={cn("relative shrink-0", row ? "w-20" : "w-full")}>
        <BookCover
          grade={book.grade}
          subject={book.subject}
          subjectTitle={subjectTitle}
          src={book.cover}
          priority={priority}
          className={cn(
            "w-full transition-[transform,box-shadow] duration-300 ease-out",
            "group-hover:shadow-xl motion-safe:group-hover:-translate-y-1 motion-safe:group-active:translate-y-0",
          )}
        />
        {read && (
          <span
            data-testid="pdf-read-badge"
            className="bg-success absolute top-2 right-2 z-10 inline-flex size-6 items-center justify-center rounded-full text-white shadow-sm"
          >
            <Check className="size-3.5" aria-hidden />
            <span className="sr-only">{t("read")}</span>
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="group-hover:text-link line-clamp-2 text-[0.9375rem] leading-snug font-semibold text-balance transition-colors">
          {title}
        </h3>
        <p className="text-muted line-clamp-1 text-sm">
          {t("meta", { grade: book.grade, subject: subjectTitle })}
        </p>
        <p className="text-muted text-sm tabular-nums">{info}</p>
        {(resuming || book.unverified) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {resuming && <Badge variant="primary">{t("resume", { page: resumePage })}</Badge>}
            {book.unverified && <Badge variant="accent">{t("unverified")}</Badge>}
          </div>
        )}
        {fraction > 0 && (
          <div
            aria-hidden
            data-testid="pdf-card-progress"
            className="bg-subtle mt-auto h-1 overflow-hidden rounded-full"
          >
            <div
              className={cn("h-full rounded-full", read ? "bg-success" : "bg-primary-600")}
              style={{ width: `${Math.round(fraction * 100)}%` }}
            />
          </div>
        )}
      </div>
    </Link>
  );
}

/** Yuklanish holati: kartaning o'zi bilan bir xil o'lcham (layout sakramasin). */
export function PdfBookCardSkeleton() {
  return (
    <div className="flex flex-col gap-3.5">
      <Skeleton className="aspect-[2/3] w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3.5 w-3/5" />
    </div>
  );
}
