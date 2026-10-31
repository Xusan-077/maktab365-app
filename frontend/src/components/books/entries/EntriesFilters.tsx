"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { FilterChip } from "@/components/site/FilterChip";
import { Button } from "@/components/ui/Button";
import { Select, type SelectOption } from "@/components/ui/Select";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { EntryBookCount } from "@/lib/books/api";
import { colorLabelKey, HIGHLIGHT_COLORS } from "@/lib/books/annotations";
import { ENTRY_TYPES, activeEntryFilterCount, type EntryFilters } from "@/lib/books/entries";
import { cn } from "@/lib/utils/cn";

const ALL = "all";
const SEARCH_DELAY_MS = 350;

interface Props {
  filters: EntryFilters;
  books: readonly EntryBookCount[];
  onChange: (patch: Partial<EntryFilters>) => void;
  onReset: () => void;
}

/** Kitob, tur, rang va qidiruv. Holat URL'da (`onChange` URL'ni yangilaydi). */
export function EntriesFilters({ filters, books, onChange, onReset }: Props) {
  const t = useTranslations("books.entries");
  const tc = useTranslations("books.workspace.colors");
  const [search, setSearch] = useState(filters.q ?? "");
  const debounced = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);
  const lastPushed = useRef(filters.q ?? "");

  useEffect(() => {
    if (debounced === lastPushed.current) return;
    lastPushed.current = debounced;
    onChange({ q: debounced || undefined });
  }, [debounced, onChange]);

  const bookOptions: SelectOption[] = [
    { value: ALL, label: t("allBooks") },
    ...books.map((book) => ({ value: book.id, label: `${book.title} (${book.count})` })),
  ];
  const active = activeEntryFilterCount(filters);
  const showColors = filters.type === undefined || filters.type === "highlight";

  return (
    <div className="flex flex-col gap-4">
      <div role="search" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="relative">
          <Search
            className="text-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            maxLength={100}
            className="border-input-border bg-surface text-foreground placeholder:text-muted hover:border-primary-300 h-11 w-full rounded-lg border pr-3 pl-10 text-base shadow-xs transition-colors"
          />
        </div>
        <Select
          aria-label={t("book")}
          value={filters.book ?? ALL}
          searchable={books.length > 8}
          options={bookOptions}
          onChange={(value) => onChange({ book: value === ALL ? undefined : value })}
        />
      </div>

      <div className="-mx-4 sm:mx-0">
        <ul
          aria-label={t("typeLabel")}
          className="flex gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          <li className="shrink-0">
            <FilterChip
              selected={!filters.type}
              onClick={() => onChange({ type: undefined, color: undefined })}
            >
              {t("types.all")}
            </FilterChip>
          </li>
          {ENTRY_TYPES.map((type) => (
            <li key={type} className="shrink-0">
              <FilterChip
                selected={filters.type === type}
                onClick={() =>
                  onChange({ type, color: type === "highlight" ? filters.color : undefined })
                }
              >
                {t(`types.${type}`)}
              </FilterChip>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {showColors && (
          <div role="group" aria-label={t("colorLabel")} className="flex items-center gap-0.5">
            {HIGHLIGHT_COLORS.map((color) => {
              const selected = filters.color === color;
              return (
                <button
                  key={color}
                  type="button"
                  aria-pressed={selected}
                  aria-label={tc(colorLabelKey(color))}
                  title={tc(colorLabelKey(color))}
                  onClick={() => onChange({ color: selected ? undefined : color })}
                  className="flex size-9 items-center justify-center rounded-full sm:size-8"
                >
                  <span
                    className={cn(
                      "size-5 rounded-full border border-black/15",
                      selected &&
                        "ring-foreground ring-offset-surface scale-110 ring-2 ring-offset-2",
                    )}
                    style={{ backgroundColor: color }}
                  />
                </button>
              );
            })}
          </div>
        )}
        {active > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <X className="size-4" aria-hidden />
            {t("reset")}
          </Button>
        )}
      </div>
    </div>
  );
}
