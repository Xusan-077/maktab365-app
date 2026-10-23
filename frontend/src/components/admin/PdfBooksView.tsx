"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { BookCover } from "@/components/pdf/BookCover";
import { Button, buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import { parseBookParams, serializeBookParams, withFilter } from "@/lib/admin/list-params";
import { canDelete } from "@/lib/admin/permissions";
import { ADMIN_ROOT_KEY, adminQueries } from "@/lib/admin/queries";
import { ADMIN_ROUTES, adminPdfBookPath } from "@/lib/admin/routes";
import { PAGE_SIZE, type AdminPdfBook, type BookListParams } from "@/lib/admin/types";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { formatBytes } from "@/lib/utils/bytes";
import { cn } from "@/lib/utils/cn";
import { GRADES } from "@/types/catalog";
import { useAdminIdentity } from "./AdminRoleProvider";
import { ConfirmDialog } from "./ConfirmDialog";
import { Pagination } from "./Pagination";
import { QueryError } from "./QueryError";
import { BookStatusBadge } from "./StatusBadge";
import { useAdminErrorText } from "./useAdminErrorText";
import { useDebouncedSearch } from "./useDebouncedSearch";

const ALL = "all";
/** Tor ekranda yashiriladigan ustunlar (jadval gorizontal siljimasin). */
const HIDDEN_ON_SMALL: readonly string[] = ["pages", "size", "updated"];

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
  const te = useTranslations("admin.pdfEdit");
  const tc = useTranslations("admin.common");
  const locale = useLocale() as Locale;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { role } = useAdminIdentity();
  const errorText = useAdminErrorText();
  const { data: subjects } = useQuery(adminQueries.subjects());
  const [deleting, setDeleting] = useState<AdminPdfBook | null>(null);
  const remove = useMutation({
    mutationFn: (book: AdminPdfBook) => getAdminApi().deletePdfBook(book.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      toast({ variant: "success", title: te("deleted") });
      setDeleting(null);
    },
  });
  const subjectTitles = useMemo(
    () => new Map((subjects ?? []).map((s) => [s.slug, getLocalized(s.title, locale)])),
    [subjects, locale],
  );
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
            <table className="w-full min-w-[34rem] text-sm" data-testid="pdf-books-table">
              <caption className="sr-only">{t("title")}</caption>
              <thead className="bg-subtle text-muted">
                <tr>
                  {(
                    ["title", "grade", "subject", "pages", "size", "status", "updated"] as const
                  ).map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className={cn(
                        "px-4 py-2.5 text-left font-medium",
                        HIDDEN_ON_SMALL.includes(column) && "hidden md:table-cell",
                      )}
                    >
                      {t(`columns.${column}`)}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">{t("columns.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.results.map((book) => (
                  <tr key={book.id} className="hover:bg-subtle/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <BookCover
                          src={book.cover_url}
                          grade={book.grade}
                          subject={book.subject}
                          subjectTitle={subjectTitles.get(book.subject) ?? book.subject}
                          className="w-9"
                        />
                        <Link
                          href={adminPdfBookPath(book.id)}
                          className="text-link font-medium underline-offset-4 hover:underline"
                        >
                          {getLocalized(book.title, locale)}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {tg("gradeLabel", { grade: book.grade })}
                    </td>
                    <td className="px-4 py-3">{subjectTitles.get(book.subject) ?? book.subject}</td>
                    <td className="hidden px-4 py-3 tabular-nums md:table-cell">
                      {book.has_file ? book.page_count : "—"}
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap tabular-nums md:table-cell">
                      {book.has_file ? formatBytes(book.size_bytes) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <BookStatusBadge published={book.status === "published"} />
                    </td>
                    <td className="text-muted hidden px-4 py-3 whitespace-nowrap md:table-cell">
                      <time dateTime={book.updated_at}>
                        {new Date(book.updated_at).toLocaleDateString(locale)}
                      </time>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={adminPdfBookPath(book.id)}
                          aria-label={t("editLabel", { title: getLocalized(book.title, locale) })}
                          title={tc("edit")}
                          className={buttonVariants({ variant: "ghost", size: "icon" })}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Link>
                        {canDelete(role) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("deleteLabel", {
                              title: getLocalized(book.title, locale),
                            })}
                            title={tc("delete")}
                            onClick={() => {
                              remove.reset();
                              setDeleting(book);
                            }}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        )}
                      </div>
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

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={te("deleteTitle")}
        description={te("deleteDescription", {
          title: deleting ? getLocalized(deleting.title, locale) : "",
        })}
        confirmLabel={tc("delete")}
        pending={remove.isPending}
        error={remove.isError ? errorText(remove.error) : undefined}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}
