import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { BookCard } from "@/components/site/BookCard";
import { ActiveFilterChip } from "@/components/site/FilterChip";
import { Pagination } from "@/components/site/Pagination";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import {
  catalogHref,
  CATALOG_PAGE_SIZE,
  EMPTY_FILTERS,
  toApiFilters,
  type CatalogFilters as Filters,
} from "@/lib/pdf/catalog-filters";
import { getCatalogPage, getSubjects } from "@/lib/pdf-books/server";
import { ROUTES } from "@/lib/utils/routes";
import { CatalogSort } from "./CatalogSort";

const GRID = "grid grid-cols-2 gap-x-5 gap-y-8 min-[560px]:grid-cols-3 xl:grid-cols-4";
const SIZES = "(min-width: 1280px) 190px, (min-width: 560px) 30vw, 45vw";

interface Chip {
  key: string;
  label: string;
  removeHref: string;
}

/** Natijalar (server): soni, faol filtr belgilari, saralash, kitoblar to'ri va sahifalash. */
export async function CatalogResults({
  filters,
  filterButton,
}: {
  filters: Filters;
  filterButton: ReactNode;
}) {
  const t = await getTranslations("catalogPage");
  const ts = await getTranslations("site");
  const locale = (await getLocale()) as Locale;
  const href = (patch: Partial<Filters>) => catalogHref(ROUTES.textbooks, filters, patch);

  // Backend javob bermasa sahifa chiziladi, natijalar o'rnida xato holati.
  const [result, subjects] = await Promise.all([
    getCatalogPage(toApiFilters(filters)).catch(() => null),
    filters.subject ? getSubjects().catch(() => []) : Promise.resolve([]),
  ]);

  const subject = subjects.find((s) => s.slug === filters.subject);
  const chips: Chip[] = [];
  if (filters.grade) {
    chips.push({
      key: "grade",
      label: ts("gradeLabel", { grade: filters.grade }),
      removeHref: href({ grade: undefined }),
    });
  }
  if (filters.subject) {
    chips.push({
      key: "subject",
      label: t("subjectChip", {
        name: subject ? getLocalized(subject.title, locale) : filters.subject,
      }),
      removeHref: href({ subject: undefined }),
    });
  }
  for (const group of filters.groups) {
    chips.push({
      key: `group-${group}`,
      label: ts(`groupName.${group}`),
      removeHref: href({ groups: filters.groups.filter((value) => value !== group) }),
    });
  }
  if (filters.language) {
    chips.push({
      key: "language",
      label: ts(`language.${filters.language}`),
      removeHref: href({ language: undefined }),
    });
  }
  if (filters.q) {
    chips.push({ key: "q", label: `«${filters.q}»`, removeHref: href({ q: undefined }) });
  }

  if (result === null) {
    return (
      <section aria-label={t("results")} className="flex min-w-0 flex-1 flex-col gap-4">
        <p role="alert" className="text-muted text-[1.0625rem]">
          {t("errorText")}
        </p>
        <Link
          href={href({ page: filters.page })}
          className="text-link min-h-11 py-2.5 font-semibold hover:underline"
        >
          {t("retry")}
        </Link>
      </section>
    );
  }

  const pageCount = Math.ceil(result.count / CATALOG_PAGE_SIZE);

  return (
    <section aria-label={t("results")} className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-muted text-[0.9375rem]" aria-live="polite">
            {t("count", { count: result.count })}
          </span>
          {chips.map(({ key, label, removeHref }) => (
            <ActiveFilterChip key={key} label={label} removeHref={removeHref} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {filterButton}
          <CatalogSort filters={filters} />
        </div>
      </div>

      {result.results.length === 0 ? (
        <div role="status" className="flex flex-col items-start gap-3 py-8">
          <h2 className="text-xl font-extrabold">{t("emptyTitle")}</h2>
          <p className="text-muted">{t("emptyText")}</p>
          <Link
            href={catalogHref(ROUTES.textbooks, EMPTY_FILTERS)}
            className="text-link min-h-11 py-2.5 font-semibold hover:underline"
          >
            {t("reset")}
          </Link>
        </div>
      ) : (
        <ul className={GRID}>
          {result.results.map((book, index) => (
            <li key={book.id}>
              <BookCard book={book} priority={index < 4} sizes={SIZES} />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={filters.page}
        pageCount={pageCount}
        hrefFor={(page) => href({ page })}
        className="mt-4"
      />
    </section>
  );
}
