"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Search, SearchX, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import type { GameTopic } from "@/lib/games/api";
import { GAME_IDS, type GameId } from "@/lib/games/config";
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
import { ghostButton, primaryButton } from "./AnswerFeedback";
import { GameIcon } from "./GameIcon";
import { GameStartModal } from "./GameStartModal";
import { GameTopicCard } from "./GameTopicCard";

export const SEARCH_DEBOUNCE_MS = 300;

const smallButton = "h-[46px] min-w-0 rounded-[14px] px-5 text-[15px]";

function FilterButton({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean;
  label?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-game-indigo/50 h-10 min-w-11 flex-none rounded-[12px] border-2 px-3.5 text-[15px] font-bold whitespace-nowrap transition-colors duration-150 focus-visible:ring-4 focus-visible:outline-none",
        selected
          ? "border-game-indigo bg-game-indigo text-white shadow-[0_3px_0_var(--color-game-indigo-deep)]"
          : "border-border bg-surface hover:border-game-brand-ring text-[var(--game-text-2)]",
      )}
    >
      {children}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex [scrollbar-width:none] items-center gap-2 overflow-x-auto pb-1"
    >
      <span className="text-muted w-11 flex-none text-[13px]">{label}</span>
      {children}
    </div>
  );
}

/**
 * `/games`: qidiruv (300ms debounce), sinf va fan filtrlari — hammasi URL'da (`?q=&grade=&subject=`),
 * natijada mavzu kartalari; kartadagi o'yin tugmasi shu o'yin tanlangan modalni ochadi.
 */
export function GamesView() {
  const t = useTranslations("games.page");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseGameFilters(searchParams), [searchParams]);
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q ?? "");
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Debounce taymeri ishlaganda eng so'nggi filtrlar (oradan chip bosilgan bo'lishi mumkin).
  const latest = useRef(filters);
  useEffect(() => {
    latest.current = filters;
  });
  useEffect(() => () => clearTimeout(timer.current), []);
  const [active, setActive] = useState<{ topic: GameTopic; game: GameId } | null>(null);

  // "/" — qidiruvga o'tish.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, dialog, [contenteditable='true']")) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
  const failed = topics.isError && !items.length;

  return (
    <div className="font-game text-foreground max-w-site mx-auto w-full px-5 pb-20 font-semibold">
      <section className="bg-game-banner relative mt-6 overflow-hidden rounded-[24px] px-5 py-7 sm:rounded-[32px] sm:px-10 sm:pt-11 sm:pb-9">
        <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-1.2px] sm:text-[44px]">
          {t("title")}
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[17px] text-[var(--game-text-2)]">{t("lead")}</p>
        <div
          className="absolute top-9 right-10 hidden gap-3 min-[1001px]:flex"
          data-testid="games-hero-icons"
        >
          {GAME_IDS.map((game, index) => (
            <GameIcon key={game} game={game} size="hero" float delay={index * 0.4} />
          ))}
        </div>
        <search className="relative mt-[26px] block max-w-[760px]">
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              navigate({ ...filters, q: query.trim() || undefined });
            }}
          >
            <label htmlFor="games-search" className="sr-only">
              {t("searchLabel")}
            </label>
            <Search
              className="text-muted pointer-events-none absolute top-[17px] left-5 size-6 sm:top-[21px]"
              strokeWidth={2.4}
              aria-hidden
            />
            <input
              id="games-search"
              ref={input}
              type="search"
              value={query}
              maxLength={QUERY_MAX_LENGTH}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t("searchPlaceholder")}
              autoComplete="off"
              enterKeyHint="search"
              className="bg-surface placeholder:text-muted focus:border-game-indigo h-14 w-full rounded-[20px] border-2 border-transparent pr-14 pl-[58px] text-base font-semibold shadow-[0_6px_0_rgb(79_91_224/0.15)] transition-colors duration-150 outline-none placeholder:font-medium sm:h-16 sm:pr-[120px] sm:text-lg [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  navigate({ ...filters, q: undefined });
                  input.current?.focus();
                }}
                aria-label={t("clearSearch")}
                className="bg-subtle absolute top-2.5 right-3.5 flex size-9 items-center justify-center rounded-[10px] sm:top-3.5"
              >
                <X className="size-[18px]" strokeWidth={2.6} aria-hidden />
              </button>
            ) : (
              <kbd
                aria-hidden
                className="border-border bg-subtle text-muted absolute top-[18px] right-4 hidden rounded-lg border px-2 py-1 text-[13px] font-semibold sm:block"
              >
                /
              </kbd>
            )}
          </form>
        </search>
        <div className="mt-[22px] flex flex-col gap-3">
          <FilterRow label={t("gradeFilter")}>
            <FilterButton
              selected={!filters.grade}
              onClick={() => navigate({ ...filters, grade: undefined, subject: undefined })}
            >
              {t("all")}
            </FilterButton>
            {GRADES.map((grade) => (
              <FilterButton
                key={grade}
                selected={filters.grade === grade}
                label={t("grade", { grade })}
                onClick={() =>
                  navigate({
                    ...filters,
                    grade: filters.grade === grade ? undefined : grade,
                    subject: undefined,
                  })
                }
              >
                {grade}
              </FilterButton>
            ))}
          </FilterRow>
          {(subjects.data?.length ?? 0) > 0 && (
            <FilterRow label={t("subjectFilter")}>
              <FilterButton
                selected={!filters.subject}
                onClick={() => navigate({ ...filters, subject: undefined })}
              >
                {t("all")}
              </FilterButton>
              {subjects.data?.map((subject) => (
                <FilterButton
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
                </FilterButton>
              ))}
            </FilterRow>
          )}
        </div>
      </section>

      <section aria-labelledby="games-results" aria-busy={topics.isFetching}>
        <div className="mt-[34px] mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="games-results" className="text-[22px] font-extrabold" aria-live="polite">
            {topics.isPending
              ? t("searching")
              : failed
                ? t("resultsTitle")
                : filters.q
                  ? t("resultsFor", { query: filters.q })
                  : t("allTopics")}
          </h2>
          {!topics.isPending && !failed && (
            <span className="text-muted text-sm">{t("results", { count })}</span>
          )}
        </div>
        {topics.isPending ? (
          <TopicsSkeleton />
        ) : failed ? (
          <StateCard
            role="alert"
            tone="error"
            title={t("errorTitle")}
            text={t("error")}
            action={
              <button
                type="button"
                onClick={() => void topics.refetch()}
                className={cn(
                  primaryButton,
                  smallButton,
                  "bg-game-indigo [--press-deep:var(--color-game-indigo-deep)]",
                )}
              >
                {t("retry")}
              </button>
            }
          />
        ) : items.length === 0 ? (
          <StateCard
            tone="empty"
            title={t("emptyTitle")}
            text={t("empty")}
            action={
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  navigate({});
                }}
                className={cn(ghostButton, smallButton)}
              >
                {t("resetFilters")}
              </button>
            }
          />
        ) : (
          <>
            <ul
              className={cn(
                "grid grid-cols-1 gap-5 min-[721px]:grid-cols-2 min-[1001px]:grid-cols-3",
                topics.isPlaceholderData && "opacity-60 transition-opacity",
              )}
              data-testid="game-topics"
            >
              {items.map((topic, index) => (
                <li key={topic.id}>
                  <GameTopicCard
                    topic={topic}
                    query={filters.q}
                    index={index}
                    onPlay={(game) => setActive({ topic, game })}
                  />
                </li>
              ))}
            </ul>
            {topics.hasNextPage && (
              <div className="mt-7 flex justify-center">
                <button
                  type="button"
                  onClick={() => void topics.fetchNextPage()}
                  disabled={topics.isFetchingNextPage}
                  className={cn(ghostButton, smallButton, "disabled:opacity-60")}
                >
                  {topics.isFetchingNextPage ? t("loading") : t("loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <GameStartModal
        topic={active?.topic ?? null}
        initialGame={active?.game ?? null}
        onClose={() => setActive(null)}
      />
    </div>
  );
}

function StateCard({
  tone,
  title,
  text,
  action,
  role,
}: {
  tone: "error" | "empty";
  title: string;
  text: string;
  action: ReactNode;
  role?: "alert";
}) {
  const Icon = tone === "error" ? X : SearchX;
  return (
    <div
      role={role}
      className="border-border bg-surface rounded-[24px] border-2 border-dashed px-5 py-[60px] text-center"
    >
      <div
        className={cn(
          "mx-auto mb-[18px] flex size-24 items-center justify-center rounded-[30px]",
          tone === "error"
            ? "bg-game-bad-soft text-game-err-dark"
            : "bg-game-banner text-game-indigo",
        )}
      >
        <Icon className="size-11" strokeWidth={2.3} aria-hidden />
      </div>
      <h3 className="text-[22px] font-extrabold">{title}</h3>
      <p className="text-muted mx-auto mt-2 mb-5 max-w-[420px]">{text}</p>
      {action}
    </div>
  );
}

function TopicsSkeleton() {
  return (
    <ul
      className="grid grid-cols-1 gap-5 min-[721px]:grid-cols-2 min-[1001px]:grid-cols-3"
      data-testid="game-topics-skeleton"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <li
          key={index}
          className="border-border bg-surface flex flex-col gap-3.5 rounded-[24px] border p-5 shadow-[0_4px_0_var(--color-border)]"
        >
          <Skeleton className="h-[22px] w-2/5 rounded-[10px]" />
          <Skeleton className="h-[26px] w-[85%] rounded-[10px]" />
          <Skeleton className="h-4 w-3/5 rounded-[10px]" />
          <div className="border-border mt-auto flex items-center justify-between border-t border-dashed pt-3.5">
            <Skeleton className="h-4 w-20 rounded-[10px]" />
            <div className="flex gap-2">
              <Skeleton className="size-11 rounded-[14px]" />
              <Skeleton className="size-11 rounded-[14px]" />
              <Skeleton className="size-11 rounded-[14px]" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
