"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { isBookRead, usePdfProgressMap } from "@/hooks/usePdfProgressMap";
import { Link } from "@/lib/i18n/navigation";
import {
  filterBooks,
  groupCounts,
  groupParam,
  parseGroupParam,
  SUBJECT_GROUPS,
  type GroupFilter,
} from "@/lib/pdf/grade-groups";
import type { PdfBook } from "@/lib/pdf-books/api";
import { ROUTES } from "@/lib/utils/routes";
import { PdfBookCard } from "../PdfBookCard";

const TABS: GroupFilter[] = ["all", ...SUBJECT_GROUPS];

/** Brauzer URL'ini serverga murojaatsiz yangilaydi (Next `useSearchParams` ni sinxronlaydi). */
function syncUrl(group: GroupFilter, q: string) {
  const params = new URLSearchParams(window.location.search);
  const g = groupParam(group);
  if (g) params.set("guruh", g);
  else params.delete("guruh");
  if (q.trim()) params.set("q", q.trim());
  else params.delete("q");
  const query = params.toString();
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`,
  );
}

export function BookGrid({
  books,
  progress = {},
}: {
  books: PdfBook[];
  progress?: ReturnType<typeof usePdfProgressMap>;
}) {
  const t = useTranslations("pdfBooks.grade");
  return (
    <>
      <h2 className="sr-only">{t("results")}</h2>
      <ul
        data-testid="pdf-book-list"
        className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4"
      >
        {books.map((book, index) => (
          <li key={book.id}>
            <PdfBookCard
              book={book}
              priority={index < 4}
              resumePage={progress[book.id]?.page}
              read={isBookRead(progress[book.id], book.page_count)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Sinf sahifasining filtrlari: fan guruhi tablari (sonlari bilan) va nom bo'yicha qidiruv. Hamma
 * kitob serverdan tayyor keladi, filtr xotirada — shuning uchun o'tish tez; holat URL'da
 * (guruh va q parametrlari) saqlanadi va ulashish mumkin.
 */
export function GradeBooks({ books, grade }: { books: PdfBook[]; grade: number }) {
  const t = useTranslations("pdfBooks.grade");
  const searchParams = useSearchParams();
  const [group, setGroup] = useState<GroupFilter>(() => parseGroupParam(searchParams.get("guruh")));
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const progress = usePdfProgressMap();

  // Brauzer orqaga/oldinga o'tganda holat URL'ga moslanadi (o'z o'zgarishlarimiz `replaceState`).
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setGroup(parseGroupParam(params.get("guruh")));
      setQ(params.get("q") ?? "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const counts = useMemo(() => groupCounts(books, q), [books, q]);
  const visible = useMemo(() => filterBooks(books, { group, q }), [books, group, q]);
  const filtered = group !== "all" || q.trim() !== "";

  const update = (nextGroup: GroupFilter, nextQ: string) => {
    setGroup(nextGroup);
    setQ(nextQ);
    syncUrl(nextGroup, nextQ);
  };

  if (books.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        action={
          <Link
            href={ROUTES.textbooks}
            className="text-link text-sm font-medium underline-offset-4 hover:underline"
          >
            {t("otherGrades")}
          </Link>
        }
      >
        {t("empty", { grade })}
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="search" className="relative max-w-md">
        <Search
          className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(event) => update(group, event.target.value)}
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          data-testid="grade-search"
          className="border-border bg-surface text-foreground placeholder:text-muted hover:border-primary-300 h-11 w-full rounded-lg border pr-3 pl-9 text-base shadow-xs sm:h-10 sm:text-sm"
        />
      </div>

      <div
        role="group"
        aria-label={t("tabs")}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {TABS.map((tab) => (
          <Chip
            key={tab}
            selected={group === tab}
            data-testid={`grade-tab-${tab}`}
            disabled={tab !== "all" && counts[tab] === 0 && group !== tab}
            onClick={() => update(tab, q)}
            className="shrink-0"
          >
            {t(`groups.${tab}`)}
            <span className="text-muted tabular-nums">{counts[tab]}</span>
          </Chip>
        ))}
      </div>

      <div className="flex min-h-9 items-center justify-between gap-3">
        <p className="text-muted text-sm tabular-nums" aria-live="polite">
          {t("found", { count: visible.length })}
        </p>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            data-testid="grade-clear"
            onClick={() => update("all", "")}
          >
            <X className="size-4" aria-hidden />
            {t("clear")}
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={FileText}
          action={
            <Button variant="secondary" size="sm" onClick={() => update("all", "")}>
              {t("clear")}
            </Button>
          }
        >
          {t("emptyFiltered")}
        </EmptyState>
      ) : (
        <BookGrid books={visible} progress={progress} />
      )}
    </div>
  );
}
