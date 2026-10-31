"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookMarked, Pencil, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Pagination } from "@/components/admin/Pagination";
import { QueryError } from "@/components/admin/QueryError";
import { BookStatusBadge } from "@/components/admin/StatusBadge";
import { useDebouncedSearch } from "@/components/admin/useDebouncedSearch";
import { BookCover } from "@/components/books/BookCover";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ADMIN_ROUTES, adminLibraryBookPath } from "@/lib/admin/routes";
import { BOOK_TYPES } from "@/lib/books/filters";
import { Link } from "@/lib/i18n/navigation";
import {
  LIBRARY_PAGE_SIZE,
  type AdminBook,
  type AdminBookStatus,
  type AdminBookType,
  type LibraryListParams,
} from "@/lib/library/admin-api";
import { libraryQueries } from "@/lib/library/admin-queries";
import { formatDate } from "@/lib/utils/format-date";
import { useLocale } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import { LibraryProgress, LibraryStatusBadge } from "./LibraryStatus";

const ALL = "all";
const STATUSES: AdminBookStatus[] = ["ready", "processing", "failed"];

function BookRow({ book }: { book: AdminBook }) {
  const t = useTranslations("admin.library");
  const tb = useTranslations("books");
  const locale = useLocale() as Locale;
  const meta = [
    tb(`typeName.${book.type ?? "other"}`),
    book.page_count > 0 ? tb("pages", { count: book.page_count }) : null,
    formatDate(book.updated_at, locale, "dayMonth"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="border-border bg-surface flex items-start gap-3 rounded-xl border p-3 sm:items-center sm:gap-4 sm:p-4">
      <div className="w-12 shrink-0 sm:w-14">
        <BookCover title={book.title} type={book.type ?? "other"} src={book.cover_url} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link
          href={adminLibraryBookPath(book.id)}
          className="hover:text-link line-clamp-2 font-semibold"
        >
          {book.title || t("untitled")}
        </Link>
        {book.author && <p className="text-muted line-clamp-1 text-sm">{book.author}</p>}
        <p className="text-faint text-sm tabular-nums">{meta}</p>
        <div className="flex flex-wrap items-center gap-2">
          <LibraryStatusBadge book={book} />
          <BookStatusBadge published={book.is_published} />
        </div>
        <LibraryProgress book={book} className="max-w-xs" />
      </div>
      <Link
        href={adminLibraryBookPath(book.id)}
        className={buttonVariants({ variant: "secondary", size: "sm" })}
        aria-label={`${t("edit")}: ${book.title}`}
      >
        <Pencil className="size-4" aria-hidden />
        <span className="hidden sm:inline">{t("edit")}</span>
      </Link>
    </li>
  );
}

/** Kutubxona ro'yxati: qidiruv, tur va holat filtri; tayyorlanayotgan kitoblar o'zi yangilanadi. */
export function LibraryView() {
  const t = useTranslations("admin.library");
  const tb = useTranslations("books");
  const [params, setParams] = useState<LibraryListParams>({ page: 1 });
  const update = (patch: Partial<LibraryListParams>) =>
    setParams((current) => ({ ...current, page: 1, ...patch }));
  const [search, setSearch] = useDebouncedSearch(params.search, (value) =>
    update({ search: value || undefined }),
  );
  const query = useQuery(libraryQueries.list(params));

  const typeOptions: SelectOption[] = [
    { value: ALL, label: t("filters.allTypes") },
    ...BOOK_TYPES.map((value) => ({ value, label: tb(`typeName.${value}`) })),
  ];
  const statusOptions: SelectOption[] = [
    { value: ALL, label: t("filters.allStatuses") },
    ...STATUSES.map((value) => ({ value, label: t(`status.${value}`) })),
  ];
  const filtered = Boolean(params.search || params.type || params.status);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <Link href={ADMIN_ROUTES.newLibraryBook} className={buttonVariants()}>
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </Link>
        }
      />

      <div role="search" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <div className="relative">
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
        <Select
          aria-label={tb("typesLabel")}
          searchable={false}
          options={typeOptions}
          value={params.type ?? ALL}
          onChange={(value) =>
            update({ type: value === ALL ? undefined : (value as AdminBookType) })
          }
        />
        <Select
          aria-label={t("statusLabel")}
          searchable={false}
          options={statusOptions}
          value={params.status ?? ALL}
          onChange={(value) =>
            update({ status: value === ALL ? undefined : (value as AdminBookStatus) })
          }
        />
      </div>

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
            {query.data.results.map((book) => (
              <BookRow key={book.id} book={book} />
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
