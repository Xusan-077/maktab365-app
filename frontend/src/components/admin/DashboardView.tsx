"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Inbox, Layers, Library } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminQueries } from "@/lib/admin/queries";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import type { AdminDashboard } from "@/lib/admin/types";
import { Link } from "@/lib/i18n/navigation";
import { QueryError } from "./QueryError";

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
      {hint && <dd className="text-muted text-xs">{hint}</dd>}
    </div>
  );
}

function Counts({ data }: { data: AdminDashboard }) {
  const t = useTranslations("admin.dashboard");
  const tb = useTranslations("admin.bookStatus");
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="text-link size-5" aria-hidden />
          {t("books")}
        </CardTitle>
        <dl className="mt-4 grid grid-cols-3 gap-3" data-testid="books-counts">
          <Stat label={t("total")} value={data.pdf_books.total} />
          <Stat label={tb("published")} value={data.pdf_books.published} />
          <Stat label={tb("draft")} value={data.pdf_books.draft} />
        </dl>
      </Card>
      <Card>
        <CardTitle className="flex items-center gap-2">
          <Library className="text-link size-5" aria-hidden />
          {t("subjects")}
        </CardTitle>
        <dl className="mt-4" data-testid="subjects-count">
          <Stat label={t("total")} value={data.subjects_count} />
        </dl>
      </Card>
      <Card>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="text-link size-5" aria-hidden />
          {t("messages")}
        </CardTitle>
        <dl className="mt-4">
          <Stat label={t("newMessages")} value={data.new_messages} />
        </dl>
      </Card>
    </div>
  );
}

function RecentMessages({ data }: { data: AdminDashboard }) {
  const t = useTranslations("admin.dashboard");
  const tk = useTranslations("support.kinds");
  return (
    <Card>
      <CardTitle>{t("recentMessages")}</CardTitle>
      {data.recent_messages.length === 0 ? (
        <p className="text-muted mt-3 text-sm">{t("noMessages")}</p>
      ) : (
        <ul className="divide-border mt-3 divide-y">
          {data.recent_messages.map((message) => (
            <li key={message.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
              <span className="text-muted text-xs">{tk(message.kind ?? "question")}</span>
              <p className="line-clamp-2 text-sm">{message.message}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentActivity({ data }: { data: AdminDashboard }) {
  const t = useTranslations("admin.dashboard");
  const ta = useTranslations("admin.audit");
  const format = useFormatter();
  return (
    <Card>
      <CardTitle>{t("recentActivity")}</CardTitle>
      {data.recent_activity.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon={Layers}>{t("noActivity")}</EmptyState>
        </div>
      ) : (
        <ol className="divide-border mt-3 divide-y" data-testid="recent-activity">
          {data.recent_activity.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
              <p className="text-sm">
                <span className="font-medium">{entry.actor_label}</span>{" "}
                {ta.has(`actions.${entry.action}`) ? ta(`actions.${entry.action}`) : entry.action}{" "}
                <span className="text-muted">
                  {ta.has(`targets.${entry.target_type}`)
                    ? ta(`targets.${entry.target_type}`)
                    : entry.target_type}
                </span>{" "}
                <span className="font-medium">{entry.target_label}</span>
              </p>
              <time className="text-muted text-xs" dateTime={entry.created_at}>
                {format.dateTime(new Date(entry.created_at), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Dashboard: kitob/fan sonlari (kitoblar status bo'yicha), yangi xabarlar va oxirgi o'zgarishlar. */
export function DashboardView() {
  const t = useTranslations("admin.dashboard");
  const { data, error, isPending, refetch } = useQuery(adminQueries.dashboard());

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <Link
            href={ADMIN_ROUTES.pdfBooks}
            className="text-link text-sm font-medium underline-offset-4 hover:underline"
          >
            {t("allBooks")}
          </Link>
        }
      />
      {isPending ? (
        <div role="status" aria-label={t("loading")} className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <Counts data={data} />
          <div className="grid gap-4 lg:grid-cols-2">
            <RecentActivity data={data} />
            <RecentMessages data={data} />
          </div>
        </>
      )}
    </>
  );
}
