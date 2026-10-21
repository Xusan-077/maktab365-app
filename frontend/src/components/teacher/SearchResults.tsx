"use client";

import { SearchX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { SearchSnippet } from "@/components/catalog/SearchSnippet";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppPaths } from "@/hooks/useAppPaths";
import { useBooks } from "@/hooks/useBooks";
import { useSearchTopics } from "@/hooks/useSearchTopics";
import { useTeacherSelection } from "@/hooks/useTeacherSelection";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { filterBooks, matchesBook } from "@/lib/utils/teacher-filters";
import { BookGrid } from "./BookGrid";
import { TopicSaveButton } from "./SaveButtons";

/** Kitob va mavzular bo'yicha qidiruv natijalari (tanlangan fan/sinflar filtri bilan). */
export function SearchResults({ query }: { query: string }) {
  const t = useTranslations("teacher.results");
  const tErrors = useTranslations("errors");
  const locale = useLocale() as Locale;
  const paths = useAppPaths();
  const selection = useTeacherSelection();
  const booksQuery = useBooks({ q: query });
  const topicsQuery = useSearchTopics(query);
  const { data: foundBooks, isPending: booksPending } = booksQuery;
  const { data: foundTopics, isPending: topicsPending } = topicsQuery;
  const { data: allBooks = [] } = useBooks();

  if (booksQuery.isError || topicsQuery.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-danger">{tErrors("backendDown")}</p>
        <Button
          variant="secondary"
          onClick={() => void Promise.all([booksQuery.refetch(), topicsQuery.refetch()])}
        >
          {tErrors("retry")}
        </Button>
      </div>
    );
  }
  if (booksPending || topicsPending) return <Skeleton className="h-40 w-full" />;

  const bookById = new Map(allBooks.map((book) => [book.id, book]));
  const books = filterBooks(foundBooks ?? [], selection);
  const topics = (foundTopics ?? []).filter((result) => {
    const book = bookById.get(result.topic.bookId);
    return book ? matchesBook(book, selection) : true;
  });
  const hidden =
    (foundBooks?.length ?? 0) - books.length + (foundTopics?.length ?? 0) - topics.length;

  return (
    <div className="flex flex-col gap-8">
      {books.length === 0 && topics.length === 0 && (
        <EmptyState icon={SearchX}>{t("empty", { query })}</EmptyState>
      )}

      {books.length > 0 && (
        <section aria-labelledby="results-books" className="flex flex-col gap-3">
          <h2 id="results-books" className="text-xl font-semibold">
            {t("books")}
          </h2>
          <BookGrid books={books} />
        </section>
      )}

      {topics.length > 0 && (
        <section aria-labelledby="results-topics" className="flex flex-col gap-3">
          <h2 id="results-topics" className="text-xl font-semibold">
            {t("topics")}
          </h2>
          <ul className="divide-border border-border bg-surface flex flex-col divide-y rounded-xl border">
            {topics.map(({ topic, bookTitle, chapterTitle, snippet }) => {
              const title = getLocalized(topic.title, locale);
              return (
                <li key={topic.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    {topic.ready ? (
                      <Link
                        href={paths.topic(topic.bookId, topic.id)}
                        className="text-link rounded-md text-lg font-medium hover:underline"
                      >
                        {title}
                      </Link>
                    ) : (
                      <span className="text-muted text-lg">{title}</span>
                    )}
                    <p className="text-muted text-sm">
                      {getLocalized(bookTitle, locale)} · {getLocalized(chapterTitle, locale)}
                    </p>
                    <SearchSnippet snippet={snippet} className="text-muted text-sm" />
                  </div>
                  {topic.ready ? (
                    <TopicSaveButton topicId={topic.id} title={title} />
                  ) : (
                    <Badge variant="accent">{t("soon")}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {hidden > 0 && <p className="text-muted text-sm">{t("hidden", { count: hidden })}</p>}
    </div>
  );
}
