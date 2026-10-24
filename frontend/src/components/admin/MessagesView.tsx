"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ExternalLink, Inbox } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import {
  parseSupportParams,
  serializeSupportParams,
  SUPPORT_MESSAGE_KINDS,
  SUPPORT_STATUSES,
} from "@/lib/admin/list-params";
import { ADMIN_ROOT_KEY, adminQueries } from "@/lib/admin/queries";
import {
  PAGE_SIZE,
  type AdminSupportMessage,
  type SupportListParams,
  type SupportStatus,
} from "@/lib/admin/types";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { formatDate } from "@/lib/utils/format-date";
import { readerPath } from "@/lib/utils/routes";
import { Pagination } from "./Pagination";
import { QueryError } from "./QueryError";
import { useAdminErrorText } from "./useAdminErrorText";

const ALL = "all";
const NOTE_MAX = 2000;

const STATUS_VARIANT: Record<SupportStatus, BadgeVariant> = {
  new: "primary",
  in_progress: "accent",
  resolved: "success",
  spam: "neutral",
};

function Filters({
  params,
  onChange,
}: {
  params: SupportListParams;
  onChange: (patch: Partial<SupportListParams>) => void;
}) {
  const t = useTranslations("admin.messages");
  const tk = useTranslations("support.kinds");
  const locale = useLocale() as Locale;
  const { data: summary } = useQuery(adminQueries.supportSummary());

  const statusOptions: SelectOption[] = [
    { value: ALL, label: t("filters.allStatuses") },
    ...SUPPORT_STATUSES.map((status) => ({ value: status, label: t(`statuses.${status}`) })),
  ];
  const kindOptions: SelectOption[] = [
    { value: ALL, label: t("filters.allKinds") },
    ...SUPPORT_MESSAGE_KINDS.map((kind) => ({ value: kind, label: tk(kind) })),
  ];
  const bookOptions: SelectOption[] = [
    { value: ALL, label: t("filters.allBooks") },
    ...(summary?.books ?? []).map((book) => ({
      value: book.id,
      label: t("filters.book", {
        title: getLocalized(book.title as { uz: string }, locale),
        grade: book.grade,
        count: book.count,
      }),
    })),
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3" data-testid="messages-filters">
      <Select
        aria-label={t("filters.status")}
        value={params.status ?? ALL}
        options={statusOptions}
        searchable={false}
        onChange={(value) => onChange({ status: SUPPORT_STATUSES.find((s) => s === value) })}
      />
      <Select
        aria-label={t("filters.kind")}
        value={params.kind ?? ALL}
        options={kindOptions}
        searchable={false}
        onChange={(value) => onChange({ kind: SUPPORT_MESSAGE_KINDS.find((k) => k === value) })}
      />
      <Select
        aria-label={t("filters.bookLabel")}
        value={params.pdfBook ?? ALL}
        options={bookOptions}
        onChange={(value) => onChange({ pdfBook: value === ALL ? undefined : value })}
      />
    </div>
  );
}

function MessageCard({ message }: { message: AdminSupportMessage }) {
  const t = useTranslations("admin.messages");
  const tk = useTranslations("support.kinds");
  const locale = useLocale() as Locale;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const errorText = useAdminErrorText();
  const [note, setNote] = useState(message.staff_note ?? "");

  const update = useMutation({
    mutationFn: (patch: { status?: SupportStatus; staff_note?: string }) =>
      getAdminApi().updateSupportMessage(message.id, patch),
    onSuccess: async (_updated, patch) => {
      // Ro'yxat, sidebar'dagi son va dashboard bir chaqiruvda yangilanadi.
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      if (patch.staff_note !== undefined) toast({ variant: "success", title: t("noteSaved") });
    },
    onError: (error) => toast({ variant: "error", title: errorText(error) }),
  });

  const book = message.pdf_book;
  const contact = message.user_email || message.email || message.name;
  const statusOptions: SelectOption[] = SUPPORT_STATUSES.map((status) => ({
    value: status,
    label: t(`statuses.${status}`),
  }));
  const noteChanged = note.trim() !== (message.staff_note ?? "").trim();

  return (
    <li
      data-testid="message-card"
      className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={STATUS_VARIANT[message.status]}>{t(`statuses.${message.status}`)}</Badge>
        <span className="font-medium">{tk(message.kind)}</span>
        <time className="text-muted ml-auto" dateTime={message.created_at}>
          {formatDate(message.created_at, locale, "dateTime")}
        </time>
      </div>

      <p className="break-words whitespace-pre-line">{message.message}</p>

      <div className="text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {book && (
          <Link
            href={readerPath(book, message.page ?? undefined)}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="message-book-link"
            className="text-link inline-flex items-center gap-1.5 font-medium hover:underline"
          >
            <BookOpen className="size-4" aria-hidden />
            {message.page
              ? t("bookAtPage", {
                  title: getLocalized(book.title as { uz: string }, locale),
                  grade: book.grade,
                  page: message.page,
                })
              : t("bookOnly", {
                  title: getLocalized(book.title as { uz: string }, locale),
                  grade: book.grade,
                })}
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        )}
        {contact && <span className="break-all">{contact}</span>}
      </div>

      <div className="border-border flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-start">
        <div className="sm:w-48">
          <Select
            aria-label={t("statusLabel")}
            value={message.status}
            options={statusOptions}
            searchable={false}
            disabled={update.isPending}
            onChange={(value) => {
              const status = SUPPORT_STATUSES.find((s) => s === value);
              if (status && status !== message.status) update.mutate({ status });
            }}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Textarea
            aria-label={t("noteLabel")}
            placeholder={t("notePlaceholder")}
            rows={2}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {noteChanged && (
            <div>
              <Button
                variant="secondary"
                loading={update.isPending}
                onClick={() => update.mutate({ staff_note: note.trim() })}
              >
                {t("saveNote")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Admin "Xabarlar": foydalanuvchi murojaatlari (darslikdagi xato, savol…). Filtrlar URL'da
 * (`?holat=&tur=&kitob=&page=`); har xabarda kitob va bet (o'qish oynasi shu betda ochiladi),
 * holat va xodim izohi.
 */
export function MessagesView() {
  const t = useTranslations("admin.messages");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = parseSupportParams(searchParams);
  const { data, error, isPending, refetch } = useQuery(adminQueries.support(params));

  const update = (patch: Partial<SupportListParams>) => {
    const query = serializeSupportParams({ ...params, page: undefined, ...patch });
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Filters params={params} onChange={update} />
      {error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : data.results.length === 0 ? (
        <EmptyState icon={Inbox}>{t("empty")}</EmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-3" data-testid="messages-list">
            {data.results.map((message) => (
              <MessageCard key={`${message.id}-${message.updated_at}`} message={message} />
            ))}
          </ul>
          <Pagination
            page={params.page ?? 1}
            pageSize={PAGE_SIZE}
            total={data.count}
            onPageChange={(page) => update({ page })}
          />
        </>
      )}
    </div>
  );
}
