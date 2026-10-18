"use client";

import { useLocale, useTranslations } from "next-intl";
import { TopicRow } from "@/components/cabinet/TopicRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppPaths } from "@/hooks/useAppPaths";
import { useBook } from "@/hooks/useBook";
import { useBookBookmarks } from "@/hooks/useBookBookmarks";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useSubjects } from "@/hooks/useSubjects";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { BookSaveButton, TopicSaveButton } from "./SaveButtons";

function SavedBookRow({ bookId }: { bookId: string }) {
  const locale = useLocale() as Locale;
  const paths = useAppPaths();
  const tg = useTranslations("home.grades");
  const { data: book, isError } = useBook(bookId);
  const { data: subjects = [] } = useSubjects();

  if (isError) return null;
  if (!book) return <Skeleton className="h-10 w-full max-w-xs" />;
  const title = getLocalized(book.title, locale);
  const subject = subjects.find((item) => item.id === book.subjectId);
  const context = [subject && getLocalized(subject.name, locale), tg("chip", { grade: book.grade })]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Link
          href={paths.book(book.id)}
          className="text-link rounded-md font-medium hover:underline"
        >
          {title}
        </Link>
        <p className="text-muted text-sm">{context}</p>
      </div>
      <BookSaveButton bookId={book.id} title={title} />
    </div>
  );
}

const newest = <T extends { createdAt: string }>(items: T[], limit?: number) =>
  [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);

/** Saqlangan kitoblar va mavzular (eng yangisi birinchi). */
export function SavedMaterials({ limit }: { limit?: number }) {
  const t = useTranslations("teacher.saved");
  const { data: books, isPending: booksPending } = useBookBookmarks();
  const { data: topics, isPending: topicsPending } = useBookmarks();

  if (booksPending || topicsPending) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="saved-books" className="flex flex-col gap-3">
        <h3 id="saved-books" className="text-sm font-semibold">
          {t("books")}
        </h3>
        {!books || books.length === 0 ? (
          <p className="text-muted text-sm">{t("emptyBooks")}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {newest(books, limit).map((item) => (
              <li key={item.id}>
                <SavedBookRow bookId={item.bookId} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="saved-topics" className="flex flex-col gap-3">
        <h3 id="saved-topics" className="text-sm font-semibold">
          {t("topics")}
        </h3>
        {!topics || topics.length === 0 ? (
          <p className="text-muted text-sm">{t("emptyTopics")}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {newest(topics, limit).map((item) => (
              <li key={item.id}>
                <TopicRow
                  topicId={item.topicId}
                  action={(title) => <TopicSaveButton topicId={item.topicId} title={title} />}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
