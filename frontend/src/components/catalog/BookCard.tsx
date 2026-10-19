"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAppPaths } from "@/hooks/useAppPaths";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import type { Book, TopicSummary } from "@/types/catalog";
import type { LocalizedText } from "@/types/i18n";
import { BookCover } from "./BookCover";
import { BookReadProgress } from "./BookReadProgress";

export interface BookCardProps {
  book: Book;
  subjectName: LocalizedText;
  locale: Locale;
  /** Qidiruv so'rovi bo'yicha shu kitobdan topilgan mavzular. */
  matchedTopics?: TopicSummary[];
  /** Tugmalar qatoriga qo'shimcha amal (masalan, "Saqlash"). */
  actions?: ReactNode;
}

export function BookCard({
  book,
  subjectName,
  locale,
  matchedTopics = [],
  actions,
}: BookCardProps) {
  const t = useTranslations();
  const paths = useAppPaths();
  const title = getLocalized(book.title, locale);
  const subject = getLocalized(subjectName, locale);

  return (
    <Card className="flex h-full gap-4 p-4 sm:p-5">
      <BookCover
        book={book}
        subjectName={subjectName}
        locale={locale}
        className="w-24 shrink-0 self-start sm:w-28"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="primary">{t("home.grades.chip", { grade: book.grade })}</Badge>
            <Badge>{subject}</Badge>
          </div>
          <h3 className="text-base leading-snug font-semibold">
            <Link href={paths.book(book.id)} className="rounded-md hover:underline">
              {title}
            </Link>
          </h3>
        </div>

        <dl className="text-muted grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <dt>{t("book.author")}</dt>
          <dd className="text-foreground">{getLocalized(book.author, locale)}</dd>
          <dt>{t("book.year")}</dt>
          <dd className="text-foreground">{book.publishedYear}</dd>
          <dt>{t("book.edition")}</dt>
          <dd className="text-foreground">{getLocalized(book.edition, locale)}</dd>
        </dl>

        {book.topicsReady && <BookReadProgress bookId={book.id} title={title} />}

        {matchedTopics.length > 0 && (
          <div className="text-sm">
            <p className="text-muted mb-1">{t("catalog.matchedTopics")}</p>
            <ul className="flex flex-wrap gap-1.5">
              {matchedTopics.slice(0, 3).map((topic) => (
                <li key={topic.id}>
                  {topic.ready ? (
                    <Link
                      href={paths.topic(book.id, topic.id)}
                      className="bg-accent-soft text-accent-soft-foreground rounded-full px-2.5 py-0.5 text-xs font-medium hover:underline"
                    >
                      {getLocalized(topic.title, locale)}
                    </Link>
                  ) : (
                    <span className="bg-subtle rounded-full px-2.5 py-0.5 text-xs">
                      {getLocalized(topic.title, locale)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {book.pdfUrl ? (
            <a
              href={book.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              {t("book.pdfRead")}
            </a>
          ) : (
            <span
              role="link"
              aria-disabled="true"
              title={t("book.pdfMissing")}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              {t("book.pdfRead")}
            </span>
          )}
          {book.topicsReady ? (
            <Link href={paths.book(book.id)} className={buttonVariants({ size: "sm" })}>
              {t("book.learn")}
            </Link>
          ) : (
            <Badge variant="accent">{t("book.soon")}</Badge>
          )}
          {actions}
        </div>
      </div>
    </Card>
  );
}
