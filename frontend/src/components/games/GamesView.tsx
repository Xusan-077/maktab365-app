"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Gamepad2, Search, SearchX, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { FilterChip } from "@/components/site/FilterChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { GameTopic } from "@/lib/games/api";
import {
  gamesHref,
  GRADES,
  parseGameFilters,
  QUERY_MAX_LENGTH,
  type GameFilters,
} from "@/lib/games/filters";
import { gameQueries } from "@/lib/games/queries";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { useRouter } from "@/lib/i18n/navigation";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { cn } from "@/lib/utils/cn";
import { GameStartModal } from "./GameStartModal";
import { GameTopicCard } from "./GameTopicCard";

export const SEARCH_DEBOUNCE_MS = 300;

const chipRow =
  "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0";

/**
 * `/games`: katta qidiruv (300ms debounce), sinf va fan chiplari — hammasi URL'da
 * (`?q=&grade=&subject=`), natijada mavzu kartalari; karta bosilsa kirish modali ochiladi.
 */
export function GamesView() {
  const t = useTranslations("games.page");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseGameFilters(searchParams), [searchParams]);
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Debounce taymeri ishlaganda eng so'nggi filtrlar (oradan chip bosilgan bo'lishi mumkin).
  const latest = useRef(filters);
  useEffect(() => {
    latest.current = filters;
  });
  useEffect(() => () => clearTimeout(timer.current), []);
  const [active, setActive] = useState<GameTopic | null>(null);

  // O'zimiz yozgan `q` — URL'ga yetib kelganda inputni qayta yozmaslik uchun (yozish davom etayotgan bo'lishi mumkin).
  const [pushedQ, setPushedQ] = useState(filters.q);
  const navigate = (next: GameFilters) => {
    clearTimeout(timer.current);
    setPushedQ(next.q);
    startTransition(() => router.replace(gamesHref(next), { scroll: false }));
  };

  // Yozilgan matn 300ms to'xtagach URL'ga; URL'dagisi bilan bir xil bo'lsa hech narsa qilinmaydi.
  const onQueryChange = (value: string) => {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = value.trim() || undefined;
      if (q !== latest.current.q) navigate({ ...latest.current, q });
    }, SEARCH_DEBOUNCE_MS);
  };

  // "Orqaga"/havola bilan URL o'zgarsa input ham shunga moslashadi.
  const [syncedQ, setSyncedQ] = useState(filters.q);
  if (syncedQ !== filters.q) {
    setSyncedQ(filters.q);
    if (filters.q !== pushedQ) setQuery(filters.q ?? "");
  }

  const subjects = useQuery(pdfQueries.subjects(filters.grade));
  const topics = useInfiniteQuery(gameQueries.topics(filters));
  const items = topics.data?.pages.flatMap((page) => page.results) ?? [];
  const count = topics.data?.pages[0]?.count ?? 0;
  const hasFilters = Boolean(filters.q || filters.grade || filters.subject);

  return (
    <div className="font-game max-w-site mx-auto flex w-full flex-col gap-8 px-4 pt-10 pb-20 sm:px-8 sm:pt-14">
      <header className="flex flex-col items-center gap-5 text-center">
        <span className="bg-game-indigo flex size-16 items-center justify-center rounded-[1.375rem] text-white shadow-[0_10px_24px_-10px_var(--color-game-indigo)]">
          <Gamepad2 className="size-8" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] sm:text-[2.75rem]">
            {t("title")}
          </h1>
          <p className="text-muted text-base sm:text-lg">{t("lead")}</p>
        </div>
        <search className="w-full max-w-3xl">
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              navigate({ ...filters, q: query.trim() || undefined });
            }}
            className="relative"
          >
            <label htmlFor="games-search" className="sr-only">
              {t("searchLabel")}
            </label>
            <Search
              className="text-muted pointer-events-none absolute top-1/2 left-5 size-6 -translate-y-1/2"
              aria-hidden
            />
            <input
              id="games-search"
              type="search"
              value={query}
              maxLength={QUERY_MAX_LENGTH}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t("searchPlaceholder")}
              autoComplete="off"
              enterKeyHint="search"
              className="border-border bg-surface text-foreground placeholder:text-placeholder focus:border-game-indigo focus:ring-game-indigo/20 h-16 w-full rounded-[1.5rem] border-2 pr-14 pl-14 text-base font-semibold shadow-[0_10px_30px_-18px_rgb(15_23_42/0.35)] transition-[border-color,box-shadow] outline-none focus:ring-4 sm:text-lg [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  navigate({ ...filters, q: undefined });
                }}
                aria-label={t("clearSearch")}
                className="text-muted hover:bg-subtle hover:text-foreground absolute top-1/2 right-3 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full"
              >
                <X className="size-5" aria-hidden />
              </button>
            )}
          </form>
        </search>
      </header>

      <section className="flex flex-col gap-3" aria-label={t("gradeFilter")}>
        <h2 className="text-muted text-sm font-bold tracking-wide uppercase">{t("gradeFilter")}</h2>
        <div className={chipRow}>
          <FilterChip
            selected={!filters.grade}
            onClick={() => navigate({ ...filters, grade: undefined, subject: undefined })}
          >
            {t("allGrades")}
          </FilterChip>
          {GRADES.map((grade) => (
            <FilterChip
              key={grade}
              selected={filters.grade === grade}
              onClick={() =>
                navigate({
                  ...filters,
                  grade: filters.grade === grade ? undefined : grade,
                  subject: undefined,
                })
              }
            >
              {t("grade", { grade })}
            </FilterChip>
          ))}
        </div>
      </section>

      {(subjects.data?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-3" aria-label={t("subjectFilter")}>
          <h2 className="text-muted text-sm font-bold tracking-wide uppercase">
            {t("subjectFilter")}
          </h2>
          <div className={chipRow}>
            <FilterChip
              selected={!filters.subject}
              onClick={() => navigate({ ...filters, subject: undefined })}
            >
              {t("allSubjects")}
            </FilterChip>
            {subjects.data?.map((subject) => (
              <FilterChip
                key={subject.slug}
                selected={filters.subject === subject.slug}
                onClick={() =>
                  navigate({
                    ...filters,
                    subject: filters.subject === subject.slug ? undefined : subject.slug,
                  })
                }
              >
                {getLocalized(subject.title, locale)}
              </FilterChip>
            ))}
          </div>
        </section>
      )}

      <section
        aria-labelledby="games-results"
        className="flex flex-col gap-4"
        aria-busy={topics.isFetching}
      >
        <h2 id="games-results" className="text-foreground text-lg font-bold" aria-live="polite">
          {topics.isPending
            ? t("loading")
            : topics.isError && !items.length
              ? null
              : t("results", { count })}
        </h2>
        {topics.isPending ? (
          <TopicsSkeleton />
        ) : topics.isError && !items.length ? (
          <div
            role="alert"
            className="border-danger-soft bg-danger-soft/50 flex flex-col items-center gap-3 rounded-[1.5rem] border px-4 py-10 text-center"
          >
            <p className="text-foreground font-semibold">{t("error")}</p>
            <button
              type="button"
              onClick={() => void topics.refetch()}
              className="game-press bg-game-indigo h-12 rounded-[1rem] px-6 font-bold text-white"
            >
              {t("retry")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            className="rounded-[1.5rem] py-12"
            action={
              hasFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    navigate({});
                  }}
                  className="text-link font-semibold underline-offset-4 hover:underline"
                >
                  {t("resetFilters")}
                </button>
              ) : undefined
            }
          >
            {t("empty")}
          </EmptyState>
        ) : (
          <>
            <ul
              className={cn(
                "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
                topics.isPlaceholderData && "opacity-60 transition-opacity",
              )}
              data-testid="game-topics"
            >
              {items.map((topic) => (
                <li key={topic.id}>
                  <GameTopicCard topic={topic} onPlay={() => setActive(topic)} />
                </li>
              ))}
            </ul>
            {topics.hasNextPage && (
              <button
                type="button"
                onClick={() => void topics.fetchNextPage()}
                disabled={topics.isFetchingNextPage}
                className="border-border bg-surface hover:bg-subtle mx-auto h-12 rounded-[1rem] border-2 px-6 font-bold disabled:opacity-60"
              >
                {topics.isFetchingNextPage ? t("loading") : t("loadMore")}
              </button>
            )}
          </>
        )}
      </section>

      <GameStartModal topic={active} onClose={() => setActive(null)} />
    </div>
  );
}

function TopicsSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="game-topics-skeleton">
      {Array.from({ length: 6 }, (_, index) => (
        <li
          key={index}
          className="border-border bg-surface flex flex-col gap-3 rounded-[1.5rem] border p-5"
        >
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
          <div className="mt-6 flex justify-between">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>
        </li>
      ))}
    </ul>
  );
}
