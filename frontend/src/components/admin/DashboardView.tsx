"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, BookOpen, Files, Inbox, Layers, Library, Plus, RefreshCw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminQueries } from "@/lib/admin/queries";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import type { AdminDashboard } from "@/lib/admin/types";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { QueryError } from "./QueryError";

function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
      {hint && <dd className="text-muted text-xs">{hint}</dd>}
    </>
  );
  if (!href) return <div className="flex flex-col gap-0.5">{body}</div>;
  return (
    <Link
      href={href}
      title={hint}
      className="hover:bg-subtle -m-2 flex flex-col gap-0.5 rounded-lg p-2 transition-colors"
    >
      {body}
    </Link>
  );
}

function Counts({ data }: { data: AdminDashboard }) {
  const t = useTranslations("admin.dashboard");
  const tb = useTranslations("admin.bookStatus");
  const { total, published, draft } = data.pdf_books;
  const percent = total === 0 ? 0 : Math.round((published / total) * 100);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="text-link size-5" aria-hidden />
          {t("books")}
        </CardTitle>
        <dl className="mt-4 grid grid-cols-3 gap-3" data-testid="books-counts">
          <Stat
            label={t("total")}
            value={total}
            hint={t("openBooks")}
            href={ADMIN_ROUTES.pdfBooks}
          />
          <Stat
            label={tb("published")}
            value={published}
            hint={t("publishedHint")}
            href={`${ADMIN_ROUTES.pdfBooks}?status=published`}
          />
          <Stat
            label={tb("draft")}
            value={draft}
            hint={t("draftHint")}
            href={`${ADMIN_ROUTES.pdfBooks}?status=draft`}
          />
        </dl>
        <div className="mt-4 flex flex-col gap-1">
          <ProgressBar value={percent} label={t("publishedShare")} />
          <p className="text-muted text-xs">{t("shareValue", { percent })}</p>
        </div>
      </Card>
      <Card>
        <CardTitle className="flex items-center gap-2">
          <Library className="text-link size-5" aria-hidden />
          {t("subjects")}
        </CardTitle>
        <dl className="mt-4" data-testid="subjects-count">
          <Stat
            label={t("total")}
            value={data.subjects_count}
            hint={t("openSubjects")}
            href={ADMIN_ROUTES.subjects}
          />
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

function QuickActions() {
  const t = useTranslations("admin.dashboard");
  const actions = [
    { href: ADMIN_ROUTES.newPdfBook, label: t("addBook"), Icon: Plus, primary: true },
    { href: ADMIN_ROUTES.bulkPdfBooks, label: t("bulkUpload"), Icon: Files },
    { href: ADMIN_ROUTES.subjects, label: t("addSubject"), Icon: Library },
    { href: ADMIN_ROUTES.stats, label: t("stats"), Icon: BarChart3 },
  ] as const;
  return (
    <Card>
      <CardTitle>{t("quickTitle")}</CardTitle>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map(({ href, label, Icon, ...rest }) => (
          <Link
            key={href}
            href={href}
            className={cn(buttonVariants({ variant: "primary" in rest ? "primary" : "secondary" }))}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </div>
    </Card>
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
  const { data, error, isPending, isFetching, refetch } = useQuery(adminQueries.dashboard());

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" disabled={isFetching} onClick={() => void refetch()}>
              <RefreshCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden />
              {t("refresh")}
            </Button>
            <Link
              href={ADMIN_ROUTES.pdfBooks}
              className="text-link text-sm font-medium underline-offset-4 hover:underline"
            >
              {t("allBooks")}
            </Link>
          </div>
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
          <QuickActions />
          <div className="grid gap-4 lg:grid-cols-2">
            <RecentActivity data={data} />
            <RecentMessages data={data} />
          </div>
        </>
      )}
    </>
  );
}
