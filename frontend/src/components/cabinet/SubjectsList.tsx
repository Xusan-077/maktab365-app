"use client";

import { BookOpen, Settings } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppPaths } from "@/hooks/useAppPaths";
import { useChapters } from "@/hooks/useChapters";
import { useMyBooks } from "@/hooks/useMyBooks";
import { useProgress } from "@/hooks/useProgress";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { catalogPath, ROUTES } from "@/lib/utils/routes";
import type { Book } from "@/types/catalog";
import type { Progress } from "@/types/progress";

function BookRow({
  book,
  subjectName,
  progress,
}: {
  book: Book;
  subjectName: string;
  progress: Progress[];
}) {
  const t = useTranslations("cabinet.subjects");
  const paths = useAppPaths();
  const locale = useLocale() as Locale;
  const { data: chapters } = useChapters(book.id);

  const topics = chapters?.flatMap((chapter) => chapter.topics).filter((topic) => topic.ready);
  const read = new Set(
    progress.filter((item) => item.readStatus === "completed").map((item) => item.topicId),
  );
  const done = topics?.filter((topic) => read.has(topic.id)).length ?? 0;
  const bookTitle = getLocalized(book.title, locale);

  return (
    <li className="flex flex-col gap-1.5">
      <Link href={paths.book(book.id)} className="text-link rounded-md font-medium hover:underline">
        {subjectName}
      </Link>
      <p className="text-muted text-sm">{bookTitle}</p>
      {!topics ? (
        <Skeleton className="h-4 w-full max-w-xs" />
      ) : topics.length === 0 ? (
        <p className="text-muted text-sm">{t("soon")}</p>
      ) : (
        <div className="flex max-w-xs flex-col gap-1">
          <ProgressBar
            value={done}
            max={topics.length}
            label={t("progressLabel", { title: subjectName })}
          />
          <p className="text-muted text-sm">{t("topicsRead", { done, total: topics.length })}</p>
        </div>
      )}
    </li>
  );
}

/** Sinfga mos fanlar (darsliklar) va har birida o'qilgan mavzular soni. */
export function SubjectsList({ limit }: { limit?: number }) {
  const t = useTranslations("cabinet.subjects");
  const tc = useTranslations("cabinet");
  const locale = useLocale() as Locale;
  const { grade, books, subjects, isPending } = useMyBooks();
  const { data: progress = [] } = useProgress();

  if (grade === undefined) {
    return (
      <EmptyState
        icon={Settings}
        action={
          <Link href={ROUTES.settings} className={buttonVariants({ variant: "secondary" })}>
            {t("settings")}
          </Link>
        }
      >
        {t("noGrade")}
      </EmptyState>
    );
  }
  if (isPending) return <Skeleton className="h-20 w-full" />;
  if (books.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        action={
          limit === undefined ? (
            <Link
              href={catalogPath("kabinet")}
              className={buttonVariants({ variant: "secondary" })}
            >
              {tc("browse")}
            </Link>
          ) : undefined
        }
      >
        {t("empty")}
      </EmptyState>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {books.slice(0, limit).map((book) => {
        const subject = subjects.find((item) => item.id === book.subjectId);
        return (
          <BookRow
            key={book.id}
            book={book}
            subjectName={
              subject ? getLocalized(subject.name, locale) : getLocalized(book.title, locale)
            }
            progress={progress}
          />
        );
      })}
    </ul>
  );
}
