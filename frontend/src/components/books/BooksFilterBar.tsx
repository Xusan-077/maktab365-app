"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { FilterChip } from "@/components/site/FilterChip";
import { Select, type SelectOption } from "@/components/ui/Select";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { BOOK_LANGUAGES, booksHref, type BooksUrlFilters } from "@/lib/books/filters";
import type { BookLanguage, BookTypeInfo } from "@/lib/books/api";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { useRouter } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";

const ALL = "all";
const SEARCH_DELAY_MS = 350;

/**
 * Filtrlar paneli. Holat URL'da (natijalarni server chizadi): tur — havola-tablar, sinf va til —
 * tanlagich, qidiruv — kechiktirilgan input. Filtr o'zgarsa sahifa 1 ga qaytadi.
 */
export function BooksFilterBar({
  filters,
  types,
}: {
  filters: BooksUrlFilters;
  types: BookTypeInfo[];
}) {
  const t = useTranslations("books");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.q ?? "");
  const debounced = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);
  const lastPushed = useRef(filters.q ?? "");

  function go(patch: Partial<BooksUrlFilters>) {
    startTransition(() => router.push(booksHref(ROUTES.books, filters, patch), { scroll: false }));
  }

  useEffect(() => {
    if (debounced === lastPushed.current) return;
    lastPushed.current = debounced;
    startTransition(() =>
      router.push(booksHref(ROUTES.books, filters, { q: debounced || undefined }), {
        scroll: false,
      }),
    );
  }, [debounced, filters, router]);

  const languageOptions: SelectOption[] = [
    { value: ALL, label: t("allLanguages") },
    ...BOOK_LANGUAGES.map((value) => ({ value, label: t(`languages.${value}`) })),
  ];

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <nav aria-label={t("typesLabel")} className="-mx-4 sm:mx-0">
        <ul className="flex gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:overflow-visible sm:px-0">
          <li className="shrink-0">
            <FilterChip
              href={booksHref(ROUTES.books, filters, { type: undefined })}
              selected={!filters.type}
            >
              {t("types.all")}
            </FilterChip>
          </li>
          {types.map((type) => (
            <li key={type.id} className="shrink-0">
              <FilterChip
                href={booksHref(ROUTES.books, filters, { type: type.slug })}
                selected={filters.type === type.slug}
              >
                {getLocalized(type.name, locale)}
              </FilterChip>
            </li>
          ))}
        </ul>
      </nav>

      <div role="search" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
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
          aria-label={t("language")}
          value={filters.language ?? ALL}
          searchable={false}
          options={languageOptions}
          onChange={(value) =>
            go({ language: value === ALL ? undefined : (value as BookLanguage) })
          }
        />
      </div>
    </div>
  );
}
