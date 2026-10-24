import { Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import type { PdfBook } from "@/lib/pdf-books/api";
import { readerPath } from "@/lib/utils/routes";
import { BookCover } from "./BookCover";
import { readPercent } from "./page-window";

export interface ContinueReadingCardProps {
  book: PdfBook;
  /** Oxirgi o'qilgan bet (1 dan). */
  lastPage: number;
}

/** "O'qishni davom ettiring": kichik muqova, nom, "45-betda to'xtagansiz", progress va play tugmasi. */
export function ContinueReadingCard({ book, lastPage }: ContinueReadingCardProps) {
  const t = useTranslations("site");
  const locale = useLocale() as Locale;
  const percent = readPercent(lastPage, book.page_count);

  return (
    <Link
      href={readerPath(book, lastPage)}
      className="border-border bg-surface text-foreground flex items-center gap-[1.125rem] rounded-[1.125rem] border p-4 transition-shadow hover:shadow-md"
    >
      <span className="w-[4.5rem] shrink-0">
        <BookCover
          grade={book.grade}
          title={getLocalized(book.subject_title, locale)}
          group={book.subject_group}
          src={book.cover}
          srcSmall={book.cover_small}
          size="sm"
          sizes="72px"
          className="shadow-none"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-[1.0625rem] font-bold">{getLocalized(book.title, locale)}</span>
        <span className="text-muted text-sm">
          {t("stoppedAt", { grade: book.grade, page: lastPage })}
        </span>
        <span
          role="progressbar"
          aria-label={t("progressLabel")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="bg-brand-soft block h-1.5 overflow-hidden rounded-[3px]"
        >
          <span className="bg-brand block h-full rounded-[3px]" style={{ width: `${percent}%` }} />
        </span>
      </span>
      <span
        aria-hidden
        className="bg-brand flex size-11 shrink-0 items-center justify-center rounded-full text-white"
      >
        <Play className="size-[1.125rem]" fill="currentColor" />
      </span>
    </Link>
  );
}
