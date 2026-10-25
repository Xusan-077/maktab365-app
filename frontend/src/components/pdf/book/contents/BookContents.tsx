"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SearchX, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useBookContentsProgress } from "@/hooks/useBookContentsProgress";
import { Link } from "@/lib/i18n/navigation";
import {
  CONTENTS_FILTERS,
  defaultOpenChapter,
  filterContents,
  type BookContents as BookContentsData,
  type ContentsFilter,
  type ContentsRow,
} from "@/lib/pdf/book-contents";
import { cn } from "@/lib/utils/cn";
import { readerPagePath, type BookRef } from "@/lib/utils/routes";
import { sectionHeading } from "../book-styles";
import { ContentsChapterCard, PageNumber } from "./ContentsChapterCard";
import { Highlight } from "./Highlight";

export interface BookContentsProps {
  bookId: string;
  book: BookRef;
  contents: BookContentsData;
}

/** Bobsiz qator (kirish/takrorlash, ilova): punktir ramkali yengil havola. */
function LooseRow({ row, book, query }: { row: ContentsRow; book: BookRef; query: string }) {
  return (
    <li>
      <Link
        href={readerPagePath(book, row.page)}
        data-testid="contents-loose"
        className="border-ds-line-2 hover:bg-ds-canvas text-ds-ink-2 flex min-h-11 items-center gap-3 rounded-[20px] border border-dashed px-4 py-3 text-[15px] font-semibold transition-colors"
      >
        <span className="min-w-0 flex-1">
          <Highlight text={row.title} query={query} />
        </span>
        <PageNumber page={row.page} />
      </Link>
    </li>
  );
}

/**
 * Kitob sahifasidagi mundarija: sarlavha va meta, qidiruv (Ctrl/⌘+K), filtr chiplari, bob
 * kartalari (akkordeon). Tuzilma serverda hisoblanadi (`buildBookContents`), o'qish holati
 * klientda qoplanadi — holat aniq bo'lguncha skelet, boblar yopiq.
 */
export function BookContents({ bookId, book, contents }: BookContentsProps) {
  const t = useTranslations("pdfBooks.contents");
  const { ready, progress } = useBookContentsProgress(bookId, contents);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ContentsFilter>("all");
  // Foydalanuvchi ochgan/yopgan boblar: oddiy ko'rinishda va qidiruv/filtrda alohida (filtr
  // o'zgarsa qayta hamma topilganlar ochiq).
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const [narrowToggled, setNarrowToggled] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const [interacted, setInteracted] = useState(false);

  const narrowKey = `${filter}|${query.trim()}`;
  const [seenKey, setSeenKey] = useState(narrowKey);
  if (seenKey !== narrowKey) {
    setSeenKey(narrowKey);
    setNarrowToggled(new Map());
  }

  const narrowed = filter !== "all" || query.trim().length > 0;
  const defaultOpen = ready ? defaultOpenChapter(contents, progress) : null;
  const visible = useMemo(
    () => filterContents(contents, progress, query, filter),
    [contents, progress, query, filter],
  );
  const isOpen = (id: string) =>
    narrowed ? (narrowToggled.get(id) ?? true) : (toggled.get(id) ?? id === defaultOpen);
  const anyOpen = visible.chapters.some(({ chapter }) => isOpen(chapter.id));

  const setOpen = (ids: string[], value: boolean) => {
    setInteracted(true);
    const update = (map: ReadonlyMap<string, boolean>) => {
      const next = new Map(map);
      for (const id of ids) next.set(id, value);
      return next;
    };
    if (narrowed) setNarrowToggled(update);
    else setToggled(update);
  };

  // Ctrl/⌘+K: shu sahifada mundarija qidiruviga fokus. Qidiruv allaqachon fokusda (yoki dialog
  // ochiq) bo'lsa — hech narsa qilmaymiz, global qidiruv (`PanelSearch`, window) o'zi ochiladi.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.shiftKey) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      const input = inputRef.current;
      if (!input || document.activeElement === input) return;
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      input.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const clear = () => {
    setQuery("");
    setFilter("all");
    inputRef.current?.focus();
  };

  // Radio guruhi: strelkalar bilan almashtirish (roving tabindex).
  const onChipKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + CONTENTS_FILTERS.length) % CONTENTS_FILTERS.length;
    setFilter(CONTENTS_FILTERS[next]);
    const group = event.currentTarget.parentElement;
    group?.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
  };

  if (contents.chapters.length === 0 && contents.intro.length === 0) return null;
  const nothing = visible.count === 0 && visible.chapters.length === 0;

  return (
    <section aria-labelledby="book-contents" className="font-ui flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="book-contents" className={cn(sectionHeading, "text-ds-ink sm:text-[2rem]")}>
            {t("title")}
          </h2>
          <p className="text-ds-muted mt-1 text-[15px] font-medium">
            {t("meta", { chapters: contents.chapters.length, pages: contents.totalPages })}
            {ready && <> · {t("metaRead", { count: progress.doneCount })}</>}
          </p>
        </div>
        {visible.chapters.length > 0 && (
          <button
            type="button"
            onClick={() =>
              setOpen(
                visible.chapters.map(({ chapter }) => chapter.id),
                !anyOpen,
              )
            }
            data-testid="contents-toggle-all"
            className="text-ds-accent-ink hover:bg-ds-accent-tint min-h-11 rounded-xl px-3 text-sm font-bold transition-colors"
          >
            {anyOpen ? t("collapseAll") : t("expandAll")}
          </button>
        )}
      </div>

      <label className="border-ds-line bg-ds-surface focus-within:border-ds-accent focus-within:ring-ds-accent-tint relative flex h-12 items-center gap-3 rounded-2xl border px-4 focus-within:ring-4 lg:h-[52px]">
        <Search className="text-ds-muted size-5 shrink-0" aria-hidden />
        <span className="sr-only">{t("searchLabel")}</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              setQuery("");
            }
          }}
          placeholder={t("searchPlaceholder")}
          aria-keyshortcuts="Control+K Meta+K"
          data-testid="contents-search"
          className="text-ds-ink placeholder:text-ds-muted h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd
          aria-hidden
          className="border-ds-line text-ds-muted hidden shrink-0 rounded-lg border px-2 py-0.5 font-sans text-xs font-semibold sm:inline"
        >
          {t("searchShortcut")}
        </kbd>
      </label>

      <div
        role="radiogroup"
        aria-label={t("filtersLabel")}
        className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-wrap lg:px-0"
      >
        {CONTENTS_FILTERS.map((value, index) => {
          const selected = filter === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setFilter(value)}
              onKeyDown={(event) => onChipKeyDown(event, index)}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold whitespace-nowrap transition-colors",
                selected
                  ? "border-ds-ink bg-ds-ink text-ds-surface"
                  : "border-ds-line bg-ds-surface text-ds-ink-2 hover:border-ds-line-2",
              )}
            >
              {t(`filters.${value}`)}
            </button>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite" data-testid="contents-results">
        {narrowed ? t("results", { count: visible.count }) : ""}
      </p>

      {nothing ? (
        <div
          data-testid="contents-empty"
          className="border-ds-line-2 flex flex-col items-center gap-3 rounded-[24px] border border-dashed px-6 py-10 text-center"
        >
          <SearchX className="text-ds-muted size-8" aria-hidden />
          <p className="text-ds-ink text-base font-bold">{t("empty")}</p>
          <button
            type="button"
            onClick={clear}
            className="bg-ds-ink text-ds-surface min-h-11 rounded-xl px-5 text-sm font-bold"
          >
            {t("clear")}
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="contents-list">
          {visible.intro.map((row) => (
            <LooseRow key={row.id} row={row} book={book} query={query} />
          ))}
          {visible.chapters.map(({ chapter, paragraphs, practice }) => {
            const chapterProgress = progress.chapters.get(chapter.id);
            return (
              <li key={chapter.id}>
                <ContentsChapterCard
                  chapter={chapter}
                  paragraphs={paragraphs}
                  practice={practice}
                  open={isOpen(chapter.id)}
                  animate={interacted}
                  onToggle={() => setOpen([chapter.id], !isOpen(chapter.id))}
                  state={ready ? (chapterProgress?.state ?? "unread") : null}
                  percent={chapterProgress?.percent ?? 0}
                  statuses={progress.paragraphs}
                  lastPage={progress.lastPage}
                  book={book}
                  query={query}
                />
              </li>
            );
          })}
          {visible.appendix.map((row) => (
            <LooseRow key={row.id} row={row} book={book} query={query} />
          ))}
        </ul>
      )}
    </section>
  );
}
