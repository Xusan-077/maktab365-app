"use client";

import { FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import type { PdfBook } from "@/lib/pdf-books/api";
import { pdfBookPath } from "@/lib/utils/routes";

export interface PdfBookCardProps {
  book: PdfBook;
  /** Oxirgi o'qilgan sahifa (bo'lsa "davom etish" belgisi). */
  resumePage?: number;
}

/** Katalog kartasi: muqova (1-sahifadan), nom, fan va sinf, betlar soni. */
export function PdfBookCard({ book, resumePage }: PdfBookCardProps) {
  const t = useTranslations("pdfBooks.card");
  const locale = useLocale() as Locale;
  const title = getLocalized(book.title, locale);
  return (
    <Link
      href={pdfBookPath(book.id)}
      data-testid="pdf-book-card"
      className="border-border bg-surface hover:border-primary-300 focus-visible:ring-ring flex gap-4 rounded-xl border p-3 transition-colors"
    >
      {book.cover ? (
        // Backend/R2 manzili (tashqi domen): next/image sozlamasi shart emas.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={book.cover}
          alt=""
          loading="lazy"
          className="bg-subtle h-32 w-24 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span className="bg-subtle text-muted flex h-32 w-24 shrink-0 items-center justify-center rounded-md">
          <FileText className="size-8" aria-hidden />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="line-clamp-3 font-semibold text-balance">{title}</h3>
        <p className="text-muted text-sm">
          {t("meta", { grade: book.grade, subject: getLocalized(book.subject_title, locale) })}
        </p>
        <p className="text-muted text-sm tabular-nums">{t("pages", { count: book.page_count })}</p>
        <div className="mt-auto flex flex-wrap gap-1.5">
          {resumePage && resumePage > 1 && (
            <Badge variant="primary">{t("resume", { page: resumePage })}</Badge>
          )}
          {book.unverified && <Badge variant="accent">{t("unverified")}</Badge>}
        </div>
      </div>
    </Link>
  );
}
