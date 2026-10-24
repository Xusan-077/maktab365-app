"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, FileText, Files, Pencil, Plus, Search, Trash2, X } from "lucide-react";
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
import { canDelete, canUnpublish } from "@/lib/admin/permissions";
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
import { Checkbox } from "./Checkbox";
import { ConfirmDialog } from "./ConfirmDialog";
import { Pagination } from "./Pagination";
import { QueryError } from "./QueryError";
import { BookStatusBadge } from "./StatusBadge";
import { useAdminErrorText } from "./useAdminErrorText";
import { useDebouncedSearch } from "./useDebouncedSearch";
import { useSelection } from "./useSelection";
import { ViewToggle, useViewMode } from "./ViewToggle";

type BatchKind = "publish" | "hide" | "delete";

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

/** PDF kitoblar: jadval yoki kartalar, tanlab ommaviy nashr/yashirish/o'chirish; filtrlar URL'da. */
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
  const [confirmingBatchDelete, setConfirmingBatchDelete] = useState(false);
  const [view, setView] = useViewMode("pdf-books");
  const { selected, toggle, setAll, clear } = useSelection();
  const remove = useMutation({
    mutationFn: (book: AdminPdfBook) => getAdminApi().deletePdfBook(book.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      toast({ variant: "success", title: te("deleted") });
      setDeleting(null);
    },
  });
  const batch = useMutation({
    mutationFn: async ({ kind, books }: { kind: BatchKind; books: AdminPdfBook[] }) => {
      const api = getAdminApi();
      const results = await Promise.allSettled(
        books.map((book) =>
          kind === "delete"
            ? api.deletePdfBook(book.id)
            : api.transitionPdfBook(book.id, kind === "publish" ? "published" : "draft"),
        ),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      return { kind, ok, failed: results.length - ok };
    },
    onSuccess: async ({ kind, ok, failed }) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      clear();
      setConfirmingBatchDelete(false);
      if (ok === 0) toast({ variant: "error", title: t("batch.failed") });
      else if (failed > 0) toast({ variant: "error", title: t("batch.partial", { ok, failed }) });
      else toast({ variant: "success", title: t(`batch.${kind}Done`, { count: ok }) });
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
    // Tanlov faqat ko'rinib turgan sahifaga tegishli: sahifa yoki filtr o'zgarsa tozalanadi.
    clear();
    const query = serializeBookParams(next);
    router.replace(query ? `${pathname}?${query}` : pathname);
  };
  const update = (patch: Partial<BookListParams>) => navigate(withFilter(params, patch));
  const filtered = Boolean(params.search || params.grade || params.subject || params.status);

  const pageBooks = data?.results ?? [];
  const pageIds = pageBooks.map((book) => book.id);
  const selectedBooks = pageBooks.filter((book) => selected.has(book.id));
  const allSelected = pageBooks.length > 0 && selectedBooks.length === pageBooks.length;
  const runBatch = (kind: BatchKind) => {
    // Allaqachon kerakli holatdagi kitoblar o'tkazib yuboriladi.
    const books =
      kind === "delete"
        ? selectedBooks
        : selectedBooks.filter((book) => (book.status === "published") !== (kind === "publish"));
    if (books.length === 0) {
      clear();
      return;
    }
    batch.mutate({ kind, books });
  };

  const newLink = (
    <div className="flex flex-wrap gap-2">
      <Link href={ADMIN_ROUTES.bulkPdfBooks} className={buttonVariants({ variant: "secondary" })}>
        <Files className="size-4" aria-hidden />
        {t("bulk")}
      </Link>
      <Link href={ADMIN_ROUTES.newPdfBook} className={buttonVariants()}>
        <Plus className="size-4" aria-hidden />
        {t("new")}
      </Link>
    </div>
  );

  const rowActions = (book: AdminPdfBook) => {
    const title = getLocalized(book.title, locale);
    return (
      <div className="flex justify-end gap-1">
        <Link
          href={adminPdfBookPath(book.id)}
          aria-label={t("editLabel", { title })}
          title={tc("edit")}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <Pencil className="size-4" aria-hidden />
        </Link>
        {canDelete(role) && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("deleteLabel", { title })}
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
    );
  };

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-h-10 flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            aria-label={t("select.all")}
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = selectedBooks.length > 0 && !allSelected;
            }}
            onChange={(event) => setAll(pageIds, event.target.checked)}
          />
          <span className={cn(selectedBooks.length === 0 && "text-muted")}>
            {selectedBooks.length > 0
              ? t("select.count", { count: selectedBooks.length })
              : t("select.all")}
          </span>
        </label>
        {selectedBooks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" data-testid="batch-actions">
            <Button
              size="sm"
              variant="secondary"
              disabled={batch.isPending}
              onClick={() => runBatch("publish")}
            >
              <Eye className="size-4" aria-hidden />
              {t("batch.publish")}
            </Button>
            {canUnpublish(role) && (
              <Button
                size="sm"
                variant="secondary"
                disabled={batch.isPending}
                onClick={() => runBatch("hide")}
              >
                <EyeOff className="size-4" aria-hidden />
                {t("batch.hide")}
              </Button>
            )}
            {canDelete(role) && (
              <Button
                size="sm"
                variant="danger"
                disabled={batch.isPending}
                onClick={() => {
                  batch.reset();
                  setConfirmingBatchDelete(true);
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                {t("batch.delete")}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={clear}>
              <X className="size-4" aria-hidden />
              {t("select.clear")}
            </Button>
          </div>
        )}
      </div>
      <ViewToggle value={view} onChange={setView} />
    </div>
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
          {toolbar}
          {view === "grid" ? (
            <ul
              data-testid="pdf-books-grid"
              className={cn(
                "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
                isPlaceholderData && "opacity-60",
              )}
            >
              {data.results.map((book) => {
                const title = getLocalized(book.title, locale);
                const checked = selected.has(book.id);
                return (
                  <li
                    key={book.id}
                    className={cn(
                      "border-border bg-surface relative flex flex-col gap-3 rounded-xl border p-3 transition-shadow hover:shadow-md",
                      checked && "border-primary-600 ring-primary-600 ring-1",
                    )}
                  >
                    <Checkbox
                      aria-label={t("select.row", { title })}
                      checked={checked}
                      onChange={() => toggle(book.id)}
                      className="bg-surface absolute top-4 left-4 z-10 size-5 shadow-sm"
                    />
                    <Link href={adminPdfBookPath(book.id)} className="block">
                      <BookCover
                        grade={book.grade}
                        subject={book.subject}
                        subjectTitle={subjectTitles.get(book.subject) ?? book.subject}
                        src={book.cover_url}
                        className="mx-auto w-full max-w-36"
                      />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Link
                        href={adminPdfBookPath(book.id)}
                        className="text-link line-clamp-2 text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {title}
                      </Link>
                      <p className="text-muted text-xs">
                        {tg("gradeLabel", { grade: book.grade })} ·{" "}
                        {subjectTitles.get(book.subject) ?? book.subject}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <BookStatusBadge published={book.status === "published"} />
                      {rowActions(book)}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div
              className={cn(
                "border-border bg-surface overflow-x-auto rounded-xl border",
                isPlaceholderData && "opacity-60",
              )}
            >
              <table className="w-full min-w-[36rem] text-sm" data-testid="pdf-books-table">
                <caption className="sr-only">{t("title")}</caption>
                <thead className="bg-subtle text-muted">
                  <tr>
                    <th scope="col" className="w-10 py-2.5 pr-0 pl-4">
                      <span className="sr-only">{t("select.all")}</span>
                    </th>
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
                    <tr
                      key={book.id}
                      className={cn(
                        "hover:bg-subtle/60",
                        selected.has(book.id) && "bg-primary-50/60",
                      )}
                    >
                      <td className="py-3 pr-0 pl-4">
                        <Checkbox
                          aria-label={t("select.row", { title: getLocalized(book.title, locale) })}
                          checked={selected.has(book.id)}
                          onChange={() => toggle(book.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <BookCover
                            grade={book.grade}
                            subject={book.subject}
                            subjectTitle={subjectTitles.get(book.subject) ?? book.subject}
                            src={book.cover_url}
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
                      <td className="px-4 py-3">
                        {subjectTitles.get(book.subject) ?? book.subject}
                      </td>
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
                      <td className="px-4 py-3">{rowActions(book)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={params.page ?? 1}
            pageSize={PAGE_SIZE}
            total={data.count}
            onPageChange={(page) => navigate({ ...params, page })}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmingBatchDelete}
        onOpenChange={(open) => !open && setConfirmingBatchDelete(false)}
        title={t("batch.deleteTitle", { count: selectedBooks.length })}
        description={t("batch.deleteDescription", { count: selectedBooks.length })}
        confirmLabel={tc("delete")}
        pending={batch.isPending}
        onConfirm={() => runBatch("delete")}
      />
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
