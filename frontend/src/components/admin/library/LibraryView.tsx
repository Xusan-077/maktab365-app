"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookMarked, FileText, Pencil, Plus, Search, Settings2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Pagination } from "@/components/admin/Pagination";
import { QueryError } from "@/components/admin/QueryError";
import { BookStatusBadge } from "@/components/admin/StatusBadge";
import { useDebouncedSearch } from "@/components/admin/useDebouncedSearch";
import { BookCover } from "@/components/books/BookCover";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminLibraryBookPath, adminPdfBookPath, ADMIN_ROUTES } from "@/lib/admin/routes";
import type { ReadingMode } from "@/lib/books/api";
import { bookGroup } from "@/lib/books/filters";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import {
  LIBRARY_PAGE_SIZE,
  type LibraryListParams,
  type LibraryRow,
} from "@/lib/library/admin-api";
import { libraryQueries } from "@/lib/library/admin-queries";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format-date";

const TEXTBOOK_TYPE = "maktab-darsliklari";

function Row({ row }: { row: LibraryRow }) {
  const t = useTranslations("admin.library");
  const tb = useTranslations("books");
  const locale = useLocale() as Locale;
  const typeName = getLocalized(row.type_name, locale);
  const href = row.kind === "textbook" ? adminPdfBookPath(row.id) : adminLibraryBookPath(row.id);
  const meta = [
    typeName,
    row.kind === "textbook" && row.grade ? tb("gradeLabel", { grade: row.grade }) : null,
    row.page_count > 0 ? tb("pages", { count: row.page_count }) : null,
    formatDate(row.created_at, locale, "dayMonth"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="border-border bg-surface flex items-start gap-3 rounded-xl border p-3 sm:items-center sm:gap-4 sm:p-4">
      <div className="w-12 shrink-0 sm:w-14">
        <BookCover
          title={row.title}
          typeLabel={typeName}
          group={bookGroup(row.type_slug, (row.reading_mode || "standard") as ReadingMode)}
          src={row.cover}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link href={href} className="hover:text-link line-clamp-2 font-semibold">
          {row.title || t("untitled")}
        </Link>
        {row.subtitle && <p className="text-muted line-clamp-1 text-sm">{row.subtitle}</p>}
        <p className="text-faint text-sm tabular-nums">{meta}</p>
        <div className="flex flex-wrap items-center gap-2">
          {row.kind === "book" && row.status !== "ready" && (
            <span className="text-muted text-sm font-medium">{t("status.noFile")}</span>
          )}
          <BookStatusBadge published={row.is_published} />
        </div>
      </div>
      <Link
        href={href}
        className={buttonVariants({ variant: "secondary", size: "sm" })}
        aria-label={`${t("edit")}: ${row.title}`}
      >
        <Pencil className="size-4" aria-hidden />
        <span className="hidden sm:inline">{t("edit")}</span>
      </Link>
    </li>
  );
}

const TAB = "min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors";
const TAB_ON = "border-primary-600 bg-primary-600 text-white";
const TAB_OFF = "border-border bg-surface hover:bg-subtle";

/**
 * Yagona "Kutubxona": maktab darsliklari va barcha kitoblar bitta ro'yxatda, tur bo'yicha tablar.
 * Turlarni admin boshqaradi (`/admin/kutubxona/turlar`).
 */
export function LibraryView({ initialType }: { initialType?: string }) {
  const t = useTranslations("admin.library");
  const locale = useLocale() as Locale;
  const [params, setParams] = useState<LibraryListParams>({ page: 1, type: initialType });
  const update = (patch: Partial<LibraryListParams>) =>
    setParams((current) => ({ ...current, page: 1, ...patch }));
  const [search, setSearch] = useDebouncedSearch(params.search, (value) =>
    update({ search: value || undefined }),
  );
  const query = useQuery(libraryQueries.list(params));
  const types = useQuery(libraryQueries.types());
  const filtered = Boolean(params.search || params.type);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={ADMIN_ROUTES.libraryTypes} className={buttonVariants({ variant: "ghost" })}>
              <Settings2 className="size-4" aria-hidden />
              {t("manageTypes")}
            </Link>
            <Link
              href={ADMIN_ROUTES.newPdfBook}
              className={buttonVariants({ variant: "secondary" })}
            >
              <FileText className="size-4" aria-hidden />
              {t("addTextbook")}
            </Link>
            <Link href={ADMIN_ROUTES.newLibraryBook} className={buttonVariants()}>
              <Plus className="size-4" aria-hidden />
              {t("add")}
            </Link>
          </div>
        }
      />

      <nav aria-label={t("filters.typesLabel")} className="-mx-4 sm:mx-0">
        <ul className="flex gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:overflow-visible sm:px-0">
          <li className="shrink-0">
            <button
              type="button"
              aria-pressed={!params.type}
              onClick={() => update({ type: undefined })}
              className={cn(TAB, params.type ? TAB_OFF : TAB_ON)}
            >
              {t("filters.allTypes")}
            </button>
          </li>
          {(types.data ?? []).map((type) => (
            <li key={type.id} className="shrink-0">
              <button
                type="button"
                aria-pressed={params.type === type.slug}
                onClick={() => update({ type: type.slug })}
                className={cn(
                  TAB,
                  params.type === type.slug ? TAB_ON : TAB_OFF,
                  !type.is_active && "opacity-60",
                )}
              >
                {getLocalized(type.name, locale)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div role="search" className="relative">
        <Search
          className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t("searchLabel")}
          placeholder={t("searchLabel")}
          className="border-input-border bg-surface placeholder:text-muted h-11 w-full rounded-lg border pr-3 pl-10 text-base shadow-xs sm:h-10 sm:text-sm"
        />
      </div>

      {params.type === TEXTBOOK_TYPE && (
        <p className="text-muted text-sm">
          {t("textbooksHint")}{" "}
          <Link
            href={ADMIN_ROUTES.pdfBooks}
            className="text-link underline-offset-4 hover:underline"
          >
            {t("textbooksManage")}
          </Link>
        </p>
      )}

      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <ul className="flex flex-col gap-3" aria-busy>
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index}>
              <Skeleton className="h-28 w-full rounded-xl" />
            </li>
          ))}
        </ul>
      ) : query.data.results.length === 0 ? (
        <EmptyState icon={BookMarked}>{filtered ? t("emptyFiltered") : t("empty")}</EmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {query.data.results.map((row) => (
              <Row key={`${row.kind}:${row.id}`} row={row} />
            ))}
          </ul>
          <Pagination
            page={params.page ?? 1}
            pageSize={LIBRARY_PAGE_SIZE}
            total={query.data.count}
            onPageChange={(page) => setParams((current) => ({ ...current, page }))}
          />
        </>
      )}
    </div>
  );
}
