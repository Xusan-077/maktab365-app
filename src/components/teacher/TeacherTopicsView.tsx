"use client";

import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppPaths } from "@/hooks/useAppPaths";
import { useBooks } from "@/hooks/useBooks";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTeacherSelection } from "@/hooks/useTeacherSelection";
import { apiQueries, SEARCH_MIN_LENGTH } from "@/lib/api/queries";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { filterBooks } from "@/lib/utils/teacher-filters";
import type { Book, Chapter } from "@/types/catalog";
import { FilterBar } from "./FilterBar";
import { MaterialSearch } from "./MaterialSearch";
import { TopicSaveButton } from "./SaveButtons";
import { SearchResults } from "./SearchResults";

/** Bitta kitobdagi mavzular, boblar bo'yicha; tayyor mavzular havola, qolganlari "tez orada". */
function BookTopics({ book, chapters }: { book: Book; chapters: Chapter[] }) {
  const t = useTranslations("teacher.topicsPage");
  const locale = useLocale() as Locale;
  const paths = useAppPaths();
  return (
    <section aria-labelledby={`topics-${book.id}`} className="flex flex-col gap-3">
      <h2 id={`topics-${book.id}`} className="text-xl font-semibold">
        <Link href={paths.book(book.id)} className="rounded-md hover:underline">
          {getLocalized(book.title, locale)}
        </Link>
      </h2>
      {chapters.map((chapter) => (
        <div key={chapter.id} className="flex flex-col gap-1">
          <h3 className="text-muted text-sm font-medium">
            {t("chapter", { order: chapter.order, title: getLocalized(chapter.title, locale) })}
          </h3>
          <ul className="divide-border border-border bg-surface flex flex-col divide-y rounded-xl border">
            {chapter.topics.map((topic) => {
              const title = getLocalized(topic.title, locale);
              return (
                <li
                  key={topic.id}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-2"
                >
                  {topic.ready ? (
                    <>
                      <Link
                        href={paths.topic(book.id, topic.id)}
                        className="text-link min-w-0 rounded-md text-lg font-medium hover:underline"
                      >
                        {title}
                      </Link>
                      <TopicSaveButton topicId={topic.id} title={title} />
                    </>
                  ) : (
                    <>
                      <span className="text-muted min-w-0 text-lg">{title}</span>
                      <Badge variant="accent">{t("soon")}</Badge>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

function TopicBrowser() {
  const t = useTranslations("teacher.topicsPage");
  const selection = useTeacherSelection();
  const { data: books, isPending } = useBooks();
  const filtered = books ? filterBooks(books, selection).filter((book) => book.topicsReady) : [];
  const chapterQueries = useQueries({
    queries: filtered.map((book) => apiQueries.chapters(book.id)),
  });

  if (isPending || chapterQueries.some((query) => query.isPending)) {
    return <Skeleton className="h-48 w-full" />;
  }
  if (filtered.length === 0) return <p className="text-muted">{t("empty")}</p>;

  return (
    <div className="flex flex-col gap-8">
      {filtered.map((book, index) => {
        const chapters = chapterQueries[index]?.data ?? [];
        return chapters.length > 0 ? (
          <BookTopics key={book.id} book={book} chapters={chapters} />
        ) : null;
      })}
    </div>
  );
}

/** "Mavzular": tanlangan fan va sinflardagi mavzular ro'yxati yoki mavzu qidiruvi. */
export function TeacherTopicsView() {
  const t = useTranslations("teacher.topicsPage");
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 250);
  const searching = debounced.length >= SEARCH_MIN_LENGTH;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted">{t("lead")}</p>
      </header>
      <MaterialSearch value={query} onChange={setQuery} />
      <FilterBar />
      {searching ? <SearchResults query={debounced} /> : <TopicBrowser />}
    </div>
  );
}
