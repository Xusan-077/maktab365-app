"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useBookContentsProgress } from "@/hooks/useBookContentsProgress";
import type { Locale } from "@/lib/i18n/config";
import { Link } from "@/lib/i18n/navigation";
import type { BookContents, ContentsProgress } from "@/lib/pdf/book-contents";
import { cn } from "@/lib/utils/cn";
import { daysAgo, formatDate } from "@/lib/utils/format-date";
import { readerPagePath, type BookRef } from "@/lib/utils/routes";

export interface ContentsResumeCardProps {
  bookId: string;
  book: BookRef;
  contents: BookContents;
  className?: string;
}

/** Oxirgi o'qilgan joy nomi: joriy paragraf, aks holda shu betni o'z ichiga olgan bob yoki qator. */
function placeTitle(contents: BookContents, progress: ContentsProgress): string | null {
  const page = progress.lastPage;
  if (page === null) return null;
  for (const chapter of contents.chapters) {
    const paragraph = chapter.paragraphs.find((p) => p.id === progress.currentParagraphId);
    if (paragraph) return paragraph.label ? `${paragraph.label} ${paragraph.name}` : paragraph.name;
  }
  const chapter = contents.chapters.find((c) => c.startPage <= page && page <= c.endPage);
  if (chapter) return chapter.name;
  const rows = [...contents.intro, ...contents.appendix].filter((row) => row.page <= page);
  return rows.at(-1)?.title ?? null;
}

const lineSkeleton = "bg-ds-on-deep/15 animate-pulse rounded-md";
const primary =
  "bg-ds-on-deep text-ds-deep hover:bg-ds-on-deep/90 flex min-h-12 items-center justify-center rounded-2xl px-4 text-center text-[15px] font-extrabold transition-colors";

/**
 * O'ng ustundagi to'q ko'k "Davom ettirish" kartasi: oxirgi o'qilgan vaqt (bugun/kecha/sana),
 * joy nomi, umumiy progress va reader havolalari. Holat aniq bo'lguncha bir xil o'lchamdagi skelet
 * (CLS yo'q); "Boshidan boshlash" bo'lmaganda ham uning joyi saqlanadi.
 */
export function ContentsResumeCard({ bookId, book, contents, className }: ContentsResumeCardProps) {
  const t = useTranslations("pdfBooks.contents.card");
  const locale = useLocale() as Locale;
  const titleId = useId();
  const { ready, progress, updatedAt } = useBookContentsProgress(bookId, contents);
  const total = contents.totalPages;
  const page = progress.lastPage;
  const started = page !== null;

  let label = t("label");
  if (started && updatedAt) {
    const ago = daysAgo(updatedAt);
    const time = formatDate(updatedAt, locale, "time");
    const when =
      ago === 0
        ? t("today", { time })
        : ago === 1
          ? t("yesterday", { time })
          : formatDate(updatedAt, locale, "dayMonth");
    label = t("lastRead", { when });
  }
  const title = progress.finished
    ? t("finished")
    : started
      ? (placeTitle(contents, progress) ?? t("label"))
      : t("startTitle");

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={!ready}
      data-testid="contents-resume"
      className={cn(
        "bg-ds-deep text-ds-on-deep font-ui flex flex-col gap-4 rounded-[24px] p-6",
        className,
      )}
    >
      {ready ? (
        <>
          <p className="text-ds-on-deep/80 h-4 truncate text-xs leading-4 font-extrabold tracking-[0.08em] uppercase">
            {label}
          </p>
          <h2
            id={titleId}
            className="line-clamp-2 min-h-[3.25rem] text-xl leading-[1.625rem] font-extrabold"
          >
            {title}
          </h2>
          <div className="flex flex-col gap-2">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
              aria-label={t("percent", { percent: progress.percent })}
              className="bg-ds-on-deep/20 h-1.5 overflow-hidden rounded-full"
            >
              <div
                className="bg-ds-on-deep h-full rounded-full"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="text-ds-on-deep/85 flex h-5 justify-between gap-3 text-sm font-semibold tabular-nums">
              <span>{t("pages", { page: page ?? 0, total })}</span>
              <span>{t("percent", { percent: progress.percent })}</span>
            </div>
          </div>
          {started && !progress.finished ? (
            <Link
              href={readerPagePath(book, page)}
              data-testid="contents-resume-link"
              className={primary}
            >
              {t("resume", { page })}
            </Link>
          ) : (
            <Link
              href={readerPagePath(book, 1)}
              data-testid="contents-resume-link"
              className={primary}
            >
              {progress.finished ? t("restart") : t("start")}
            </Link>
          )}
          {started && !progress.finished ? (
            <Link
              href={readerPagePath(book, 1)}
              data-testid="contents-restart-link"
              className="text-ds-on-deep/90 hover:text-ds-on-deep -mt-2 flex min-h-11 items-center justify-center rounded-xl text-sm font-bold underline-offset-4 hover:underline"
            >
              {t("restart")}
            </Link>
          ) : (
            <div aria-hidden className="-mt-2 h-11" />
          )}
        </>
      ) : (
        <>
          <span id={titleId} className="sr-only">
            {t("label")}
          </span>
          <div className={cn(lineSkeleton, "h-4 w-40")} />
          <div className="flex min-h-[3.25rem] flex-col gap-2">
            <div className={cn(lineSkeleton, "h-5 w-full")} />
            <div className={cn(lineSkeleton, "h-5 w-2/3")} />
          </div>
          <div className="flex flex-col gap-2">
            <div className={cn(lineSkeleton, "h-1.5 w-full")} />
            <div className={cn(lineSkeleton, "h-5 w-full")} />
          </div>
          <div className={cn(lineSkeleton, "h-12 rounded-2xl")} />
          <div aria-hidden className="-mt-2 h-11" />
        </>
      )}
    </section>
  );
}
