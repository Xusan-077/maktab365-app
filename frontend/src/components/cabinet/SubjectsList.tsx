"use client";

import { BookOpen, Settings } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppPaths } from "@/hooks/useAppPaths";
import { useDashboard } from "@/hooks/useDashboard";
import { useMyBooks } from "@/hooks/useMyBooks";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { catalogPath, ROUTES } from "@/lib/utils/routes";
import type { Book } from "@/types/catalog";
import type { DashboardBook } from "@/types/progress";

function BookRow({
  book,
  subjectName,
  stats,
}: {
  book: Book;
  subjectName: string;
  /** Server hisobi; `undefined` — yuklanmoqda (`null` — kitobda tayyor mavzu yo'q). */
  stats: DashboardBook | null | undefined;
}) {
  const t = useTranslations("cabinet.subjects");
  const paths = useAppPaths();
  const locale = useLocale() as Locale;
  const bookTitle = getLocalized(book.title, locale);

  return (
    <li className="flex flex-col gap-1.5">
      <Link href={paths.book(book.id)} className="text-link rounded-md font-medium hover:underline">
        {subjectName}
      </Link>
      <p className="text-muted text-sm">{bookTitle}</p>
      {stats === undefined ? (
        <Skeleton className="h-4 w-full max-w-xs" />
      ) : stats === null ? (
        <p className="text-muted text-sm">{t("soon")}</p>
      ) : (
        <div className="flex max-w-xs flex-col gap-1">
          <ProgressBar
            value={stats.topicsRead}
            max={stats.topicsTotal}
            label={t("progressLabel", { title: subjectName })}
          />
          <p className="text-muted text-sm">
            {t("topicsRead", { done: stats.topicsRead, total: stats.topicsTotal })}
          </p>
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
  const { data: dashboard } = useDashboard();

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
            stats={
              dashboard
                ? (dashboard.subjects.find((item) => item.bookId === book.id) ?? null)
                : undefined
            }
          />
        );
      })}
    </ul>
  );
}
