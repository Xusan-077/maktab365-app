"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  currentTocGroupId,
  currentTocItem,
  filterTocGroups,
  groupToc,
  TOC_SEARCH_THRESHOLD,
  tocRowCount,
  type TocChapter,
  type TocItem,
} from "@/lib/pdf/toc";
import { cn } from "@/lib/utils/cn";

export interface TocTreeProps {
  chapters: readonly TocChapter[];
  /** Joriy sahifa (o'qish oynasi yoki saqlangan pozitsiya): shu bob ochiq, bo'lim ajratiladi. */
  page: number | null;
  /** Bitta qator (bob yoki bo'lim): havola yoki tugma — chaqiruvchi beradi. */
  renderItem: (item: TocItem, state: { active: boolean }) => ReactNode;
  testId?: string;
  /** Qidiruv maydoni qatorlar sonidan qat'i nazar (o'qish oynasi mundarijasi). */
  alwaysSearchable?: boolean;
  className?: string;
}

/**
 * Mundarija boblar bo'yicha: bob qatori + ochib-yopiladigan bo'limlari (yopiq bo'limlar `hidden` —
 * DOM'da qoladi, qidiruv tizimlari uchun havolalar yo'qolmaydi). Joriy bob ochiq turadi;
 * `TOC_SEARCH_THRESHOLD` dan ko'p qatorda mundarija ichida qidiruv chiqadi (topilganlar ochiq).
 */
export function TocTree({
  chapters,
  page,
  renderItem,
  testId,
  alwaysSearchable = false,
  className,
}: TocTreeProps) {
  const t = useTranslations("pdfBooks.toc");
  const baseId = useId();
  const groups = useMemo(() => groupToc(chapters), [chapters]);
  const currentGroup = currentTocGroupId(groups, page);
  const current =
    page === null
      ? null
      : currentTocItem(
          groups.flatMap((group) => [group.chapter, ...group.sections]),
          page,
        );
  // Faqat foydalanuvchi o'zi ochgan/yopgan boblar; qolganlari: joriy bob ochiq, boshqalari yopiq.
  // Sahifa boshqa bobga o'tsa (yoki pozitsiya keyin yuklansa) o'sha bob o'zi ochiladi.
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const [query, setQuery] = useState("");
  const isOpen = (id: string) => toggled.get(id) ?? id === currentGroup;

  const searchable = alwaysSearchable || tocRowCount(groups) > TOC_SEARCH_THRESHOLD;
  const searching = searchable && query.trim().length > 0;
  const visible = searching ? filterTocGroups(groups, query) : groups;
  const toggle = (id: string) => setToggled((map) => new Map(map).set(id, !isOpen(id)));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {searchable && (
        <label className="relative block">
          <span className="sr-only">{t("searchLabel")}</span>
          <Search
            className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            data-testid="toc-search"
            className="border-border bg-surface text-foreground placeholder:text-muted h-11 w-full rounded-lg border pr-3 pl-9 text-sm"
          />
        </label>
      )}
      {searching && visible.length === 0 ? (
        <p className="text-muted px-3 text-sm" role="status">
          {t("searchEmpty", { query: query.trim() })}
        </p>
      ) : (
        <ol className="flex flex-col gap-0.5" data-testid={testId}>
          {visible.map(({ chapter, sections }) => {
            const open = searching || isOpen(chapter.id);
            const listId = `${baseId}-${chapter.id}`;
            return (
              <li key={chapter.id} data-testid="toc-group">
                <div className="flex items-stretch gap-1">
                  <div className="min-w-0 flex-1">
                    {renderItem(chapter, { active: chapter.id === current?.id })}
                  </div>
                  {sections.length > 0 && (
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={listId}
                      aria-label={t(open ? "collapse" : "expand", { title: chapter.title })}
                      data-testid="toc-group-toggle"
                      disabled={searching}
                      onClick={() => toggle(chapter.id)}
                      className="text-muted hover:bg-subtle inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-60"
                    >
                      <ChevronDown
                        className={cn("size-5 transition-transform", open && "rotate-180")}
                        aria-hidden
                      />
                    </button>
                  )}
                </div>
                {sections.length > 0 && (
                  <ol id={listId} hidden={!open} className="flex flex-col gap-0.5">
                    {sections.map((section) => (
                      <li key={section.id}>
                        {renderItem(section, { active: section.id === current?.id })}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
