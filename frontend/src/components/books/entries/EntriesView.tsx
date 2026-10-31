"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useEntries, useEntryBooks } from "@/hooks/useEntries";
import {
  activeEntryFilterCount,
  entryQuery,
  groupEntriesByBook,
  parseEntryFilters,
  type EntryFilters,
} from "@/lib/books/entries";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { bookPath } from "@/lib/utils/routes";
import { BookExportButton } from "./BookExportButton";
import { EntriesFilters } from "./EntriesFilters";
import {
  EntriesEmpty,
  EntriesError,
  EntriesGuest,
  EntriesNoMatch,
  EntriesSkeleton,
} from "./EntriesStates";
import { EntryCard } from "./EntryCard";

/** «Mening yozuvlarim»: kitob bo'yicha guruhlangan bet yozuvlari, filtr va eksport. */
export function EntriesView() {
  const t = useTranslations("books.entries");
  const { status, signedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = useMemo(() => parseEntryFilters(params), [params]);
  const books = useEntryBooks();
  const list = useEntries(filters);
  const groups = useMemo(() => groupEntriesByBook(list.entries), [list.entries]);

  const change = useCallback(
    (patch: Partial<EntryFilters>) => {
      const query = entryQuery({ ...parseEntryFilters(params), ...patch });
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  // "Tozalash" qidiruv maydonini ham bo'shatishi uchun filtrlar paneli qayta yaratiladi.
  const [resetCount, setResetCount] = useState(0);
  const reset = useCallback(() => {
    setResetCount((value) => value + 1);
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  if (status === "loading") return <EntriesSkeleton />;
  if (!signedIn) return <EntriesGuest />;

  const filtered = activeEntryFilterCount(filters) > 0;
  const hasAny = (books.data?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6">
      {(hasAny || filtered) && (
        <EntriesFilters
          key={resetCount}
          filters={filters}
          books={books.data ?? []}
          onChange={change}
          onReset={reset}
        />
      )}

      {list.isPending ? (
        <EntriesSkeleton />
      ) : list.isError ? (
        <EntriesError onRetry={() => void list.refetch()} />
      ) : list.entries.length === 0 ? (
        filtered ? (
          <EntriesNoMatch onReset={reset} />
        ) : (
          <EntriesEmpty />
        )
      ) : (
        <>
          <p role="status" className="text-muted text-sm">
            {t("count", { count: list.total })}
          </p>
          {groups.map((group) => (
            <section key={group.book.id} aria-labelledby={`book-${group.book.id}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id={`book-${group.book.id}`} className="text-xl font-bold">
                  <Link href={bookPath(group.book.id)} className="hover:underline">
                    {group.book.title}
                  </Link>
                </h2>
                <BookExportButton bookId={group.book.id} title={group.book.title} />
              </div>
              <ul className="grid gap-3 lg:grid-cols-2">
                {group.entries.map((entry) => (
                  <EntryCard key={`${entry.book.id}:${entry.page}`} entry={entry} />
                ))}
              </ul>
            </section>
          ))}
          {list.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                loading={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {t("more")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
