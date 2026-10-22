"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { parseBookParams, serializeBookParams, withFilter } from "@/lib/admin/list-params";
import { adminQueries } from "@/lib/admin/queries";
import { ADMIN_ROUTES, adminPdfBookPath } from "@/lib/admin/routes";
import { PAGE_SIZE, type BookListParams } from "@/lib/admin/types";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { formatBytes } from "@/lib/utils/bytes";
import { cn } from "@/lib/utils/cn";
import { GRADES } from "@/types/catalog";
import { Pagination } from "./Pagination";
import { QueryError } from "./QueryError";
import { BookStatusBadge } from "./StatusBadge";
import { useDebouncedSearch } from "./useDebouncedSearch";

const ALL = "all";

function Filters({
  params,
  update,
}: {
  params: BookListParams;
  update: (patch: Partial<BookListParams>) => void;
}) {
  const t = useTranslations("admin.pdfBooks");
  const tb = useTranslations("admin.bookStatus");
  const tg = useTranslations("admin.books");
  const locale = useLocale() as Locale;
  const { data: subjects } = useQuery(adminQueries.subjects());
  const [search, setSearch] = useDebouncedSearch(params.search, (value) =>
    update({ search: value }),
  );

  const gradeOptions: SelectOption[] = [
    { value: ALL, label: tg("filters.allGrades") },
    ...GRADES.map((grade) => ({ value: String(grade), label: tg("gradeLabel", { grade }) })),
  ];
  const subjectOptions: SelectOption[] = [
    { value: ALL, label: tg("filters.allSubjects") },
    ...(subjects ?? []).map((s) => ({ value: s.slug, label: getLocalized(s.title, locale) })),
  ];
  const statusOptions: SelectOption[] = [
    { value: ALL, label: tg("filters.allStatuses") },
    { value: "published", label: tb("published") },
    { value: "draft", label: tb("draft") },
  ];

  return (
    <div role="search" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="relative">
        <Search
          className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t("filters.search")}
          placeholder={t("filters.search")}
          className="border-border bg-surface text-foreground placeholder:text-muted hover:border-primary-300 h-10 w-full rounded-lg border pr-3 pl-9 text-sm shadow-xs transition-colors"
        />
      </div>
      <Select
        aria-label={tg("filters.grade")}
        value={params.grade ? String(params.grade) : ALL}
        options={gradeOptions}
        searchable={false}
        onChange={(value) => update({ grade: value === ALL ? undefined : Number(value) })}
      />
      <Select
        aria-label={tg("filters.subject")}
        value={params.subject ?? ALL}
        options={subjectOptions}
        onChange={(value) => update({ subject: value === ALL ? undefined : value })}
      />
      <Select
        aria-label={tg("filters.status")}
        value={params.status ?? ALL}
        options={statusOptions}
        searchable={false}
        onChange={(value) =>
          update({ status: value === "published" || value === "draft" ? value : undefined })
        }
      />
    </div>
  );
}

/** PDF kitoblar jadvali: filtrlar URL search params'da (kitoblar ro'yxati bilan bir xil shakl). */
export function PdfBooksView() {
  const t = useTranslations("admin.pdfBooks");
  const tg = useTranslations("admin.books");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useMemo(() => parseBookParams(searchParams), [searchParams]);
  const { data, error, isPending, isPlaceholderData, refetch } = useQuery(
    adminQueries.pdfBooks(params),
  );

  const navigate = (next: BookListParams) => {
    const query = serializeBookParams(next);
    router.replace(query ? `${pathname}?${query}` : pathname);
  };
  const update = (patch: Partial<BookListParams>) => navigate(withFilter(params, patch));
  const filtered = Boolean(params.search || params.grade || params.subject || params.status);
  const newLink = (
    <Link href={ADMIN_ROUTES.newPdfBook} className={buttonVariants()}>
      <Plus className="size-4" aria-hidden />
      {t("new")}
    </Link>
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} action={newLink} />
      <Filters params={params} update={update} />

      {error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div role="status" aria-label={t("loading")} className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : data.results.length === 0 ? (
        <EmptyState icon={FileText} action={!filtered && newLink}>
          {filtered ? t("emptyFiltered") : t("empty")}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <div
            className={cn(
              "border-border bg-surface overflow-x-auto rounded-xl border",
              isPlaceholderData && "opacity-60",
            )}
          >
            <table className="w-full min-w-[40rem] text-sm" data-testid="pdf-books-table">
              <caption className="sr-only">{t("title")}</caption>
              <thead className="bg-subtle text-muted">
                <tr>
                  {(
                    ["title", "grade", "subject", "pages", "size", "status", "updated"] as const
                  ).map((column) => (
                    <th key={column} scope="col" className="px-4 py-2.5 text-left font-medium">
                      {t(`columns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.results.map((book) => (
                  <tr key={book.id} className="hover:bg-subtle/60">
                    <td className="px-4 py-3">
                      <Link
                        href={adminPdfBookPath(book.id)}
                        className="text-link font-medium underline-offset-4 hover:underline"
                      >
                        {getLocalized(book.title, locale)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{tg("gradeLabel", { grade: book.grade })}</td>
                    <td className="px-4 py-3">{book.subject}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {book.has_file ? book.page_count : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      {book.has_file ? formatBytes(book.size_bytes) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <BookStatusBadge published={book.status === "published"} />
                    </td>
                    <td className="text-muted px-4 py-3 whitespace-nowrap">
                      <time dateTime={book.updated_at}>
                        {new Date(book.updated_at).toLocaleDateString(locale)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={params.page ?? 1}
            pageSize={PAGE_SIZE}
            total={data.count}
            onPageChange={(page) => navigate({ ...params, page })}
          />
        </div>
      )}
    </>
  );
}
