"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppPaths } from "@/hooks/useAppPaths";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useGrades } from "@/hooks/useGrades";
import { useSearchTopics } from "@/hooks/useSearchTopics";
import { useSubjects } from "@/hooks/useSubjects";
import { apiQueries } from "@/lib/api/queries";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import {
  hasActiveFilters,
  toBookFilters,
  toSearchParams,
  type CatalogFilters,
} from "@/lib/utils/catalog-params";
import { GRADES, type Grade, type TopicSummary } from "@/types/catalog";
import { BookCard } from "./BookCard";
import { SearchSnippet } from "./SearchSnippet";

const SEARCH_DEBOUNCE_MS = 250;

/** Katalog: sinf/fan/qidiruv filtrlari URL'ga yoziladi (sahifa qayta yuklanmaydi, havola ulashish mumkin). */
export function CatalogView({ initial }: { initial: CatalogFilters }) {
  const t = useTranslations("catalog");
  const tErrors = useTranslations("errors");
  const tHome = useTranslations("home.grades");
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const reduceMotion = useReducedMotion();
  const paths = useAppPaths();

  const [grade, setGrade] = useState<Grade | undefined>(initial.grade);
  const [subject, setSubject] = useState<string | undefined>(initial.subject);
  const [input, setInput] = useState(initial.q ?? "");
  const q = useDebouncedValue(input.trim(), SEARCH_DEBOUNCE_MS) || undefined;

  const filters: CatalogFilters = { grade, subject, q };
  const bookFilters = toBookFilters(filters);
  const active = hasActiveFilters({ grade, subject, q: input.trim() || undefined });

  useEffect(() => {
    const next = toSearchParams({ grade, subject, q }, new URLSearchParams(window.location.search));
    const query = next.toString();
    if (query === window.location.search.replace(/^\?/, "")) return;
    const url = new URL(window.location.href);
    url.search = query;
    window.history.replaceState(null, "", url);
  }, [grade, subject, q]);

  const grades = useGrades();
  const subjects = useSubjects();
  const books = useQuery({ ...apiQueries.books(bookFilters), placeholderData: keepPreviousData });
  const topicHits = useSearchTopics(q ?? "", {});

  // Natija bo'sh bo'lsa, sinf filtrisiz so'rov boshqa sinflarni taklif qilish uchun
  const noResults = books.data?.length === 0;
  const broader = useQuery({
    ...apiQueries.books(toBookFilters({ subject, q })),
    enabled: noResults && grade !== undefined,
  });

  const subjectNames = useMemo(
    () => new Map((subjects.data ?? []).map((item) => [item.id, item.name])),
    [subjects.data],
  );

  const topicsByBook = useMemo(() => {
    const map = new Map<string, TopicSummary[]>();
    for (const hit of topicHits.data ?? []) {
      map.set(hit.topic.bookId, [...(map.get(hit.topic.bookId) ?? []), hit.topic]);
    }
    return map;
  }, [topicHits.data]);

  const suggestedGrades = useMemo(
    () =>
      [...new Set((broader.data ?? []).map((book) => book.grade))]
        .filter((item) => item !== grade)
        .sort((a, b) => a - b),
    [broader.data, grade],
  );

  const subjectOptions = useMemo(
    () => [
      { value: "", label: t("allSubjects") },
      ...(subjects.data ?? []).map((item) => ({
        value: item.id,
        label: getLocalized(item.name, locale),
      })),
    ],
    [subjects.data, locale, t],
  );

  const subjectLabel = subject
    ? getLocalized(subjectNames.get(subject) ?? { uz: subject }, locale)
    : "";

  function clearAll() {
    setGrade(undefined);
    setSubject(undefined);
    setInput("");
  }

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (grade !== undefined) {
    activeChips.push({
      key: "grade",
      label: tHome("chip", { grade }),
      onRemove: () => setGrade(undefined),
    });
  }
  if (subject) {
    activeChips.push({
      key: "subject",
      label: subjectLabel,
      onRemove: () => setSubject(undefined),
    });
  }
  if (q) {
    activeChips.push({
      key: "q",
      label: t("searchChip", { query: q }),
      onRemove: () => setInput(""),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <form role="search" onSubmit={(event) => event.preventDefault()} className="relative">
          <Search
            className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            className="border-border bg-surface text-foreground placeholder:text-muted hover:border-primary-300 h-12 w-full rounded-lg border pr-3 pl-10 text-base shadow-xs transition-colors"
          />
        </form>

        <div className="grid gap-4 md:grid-cols-[1fr_16rem] md:items-end">
          <div>
            <p id="catalog-grade-label" className="mb-2 text-sm font-medium">
              {t("gradeLabel")}
            </p>
            <div
              role="group"
              aria-labelledby="catalog-grade-label"
              className="flex flex-wrap gap-2"
            >
              {(grades.data ?? GRADES).map((item) => (
                <Chip
                  key={item}
                  selected={grade === item}
                  aria-label={tHome("chip", { grade: item })}
                  onClick={() => setGrade(grade === item ? undefined : item)}
                  className="h-10 min-w-10 justify-center text-base"
                >
                  {item}
                </Chip>
              ))}
            </div>
          </div>
          <Select
            label={t("subjectLabel")}
            value={subject ?? ""}
            options={subjectOptions}
            onChange={(next) => setSubject(next || undefined)}
          />
        </div>

        {active && (
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label={t("activeFilters")}
          >
            {activeChips.map((chip) => (
              <Chip
                key={chip.key}
                selected
                onClick={chip.onRemove}
                aria-label={t("removeFilter", { label: chip.label })}
                aria-pressed={undefined}
              >
                {chip.label}
                <X className="size-3.5" aria-hidden />
              </Chip>
            ))}
            <Button variant="ghost" size="sm" onClick={clearAll}>
              {t("clearAll")}
            </Button>
          </div>
        )}
      </div>

      <p aria-live="polite" className="text-muted text-sm">
        {books.data && t("resultCount", { count: books.data.length })}
      </p>

      {books.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-danger">{tErrors("backendDown")}</p>
          <Button variant="secondary" onClick={() => void books.refetch()}>
            {tErrors("retry")}
          </Button>
        </div>
      ) : books.isPending ? (
        <CatalogSkeleton label={t("loading")} />
      ) : noResults ? (
        <Card className="flex flex-col items-start gap-4 p-6">
          <h2 className="text-lg font-semibold">{t("empty.title")}</h2>
          <p className="text-muted">{t("empty.text")}</p>
          {suggestedGrades.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{t("empty.tryGrade")}</p>
              <div className="flex flex-wrap gap-2">
                {suggestedGrades.map((item) => (
                  <Chip
                    key={item}
                    aria-pressed={undefined}
                    onClick={() => setGrade(item)}
                    className="h-10 px-4"
                  >
                    {tHome("chip", { grade: item })}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {q && <p className="text-muted text-sm">{t("empty.tryQuery")}</p>}
          <Button variant="secondary" onClick={clearAll}>
            {t("clearAll")}
          </Button>
        </Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          <AnimatePresence initial={false} mode="popLayout">
            {books.data.map((book) => (
              <motion.li
                key={book.id}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <BookCard
                  book={book}
                  locale={locale}
                  subjectName={subjectNames.get(book.subjectId) ?? { uz: book.subjectId }}
                  matchedTopics={topicsByBook.get(book.id)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {q && (topicHits.data?.length ?? 0) > 0 && (
        <section aria-labelledby="catalog-topic-hits" className="flex flex-col gap-3">
          <h2 id="catalog-topic-hits" className="text-xl font-semibold">
            {t("topicsTitle")}
          </h2>
          <ul className="divide-border border-border bg-surface flex flex-col divide-y rounded-xl border">
            {topicHits.data?.map(({ topic, bookTitle, chapterTitle, snippet }) => (
              <li key={topic.id} className="flex flex-col gap-1 p-4">
                <Link
                  href={paths.topic(topic.bookId, topic.id)}
                  className="text-link rounded-md text-lg font-medium hover:underline"
                >
                  {getLocalized(topic.title, locale)}
                </Link>
                <p className="text-muted text-sm">
                  {getLocalized(bookTitle, locale)} · {getLocalized(chapterTitle, locale)}
                </p>
                <SearchSnippet snippet={snippet} className="text-muted text-sm" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function CatalogSkeleton({ label }: { label?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      className="grid gap-4 lg:grid-cols-2"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-52 rounded-xl" />
      ))}
    </div>
  );
}

/** loading.tsx uchun: sarlavha skeleti + natijalar skeleti. i18n klientda o'qiladi (loading.tsx'da locale hali yo'q). */
export function CatalogLoading() {
  const t = useTranslations("catalog");
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Skeleton className="mb-4 h-4 w-48" />
      <Skeleton className="mb-8 h-10 w-64" />
      <CatalogSkeleton label={t("loading")} />
    </div>
  );
}
