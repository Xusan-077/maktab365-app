"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminQueries } from "@/lib/admin/queries";
import { adminPdfBookPath } from "@/lib/admin/routes";
import type { AdminStats } from "@/lib/admin/types";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { QueryError } from "./QueryError";

const PERIODS = [7, 30] as const;

function Totals({ data }: { data: AdminStats }) {
  const t = useTranslations("admin.stats");
  const rows = [
    { label: t("opens"), value: data.totals.opens },
    { label: t("downloads"), value: data.totals.downloads },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:max-w-md" data-testid="stats-totals">
      {rows.map(({ label, value }) => (
        <div key={label} className="border-border bg-surface rounded-xl border p-4">
          <dt className="text-muted text-sm">{label}</dt>
          <dd className="text-2xl font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Kunlik ochilishlar: ustunlar balandligi eng katta qiymatga nisbatan (jadval ekran o'qigichlar uchun). */
function DailyBars({ data }: { data: AdminStats }) {
  const t = useTranslations("admin.stats");
  const format = useFormatter();
  const max = Math.max(1, ...data.daily.map((day) => day.opens));
  return (
    <section aria-labelledby="stats-daily" className="flex flex-col gap-3">
      <h2 id="stats-daily" className="text-lg font-semibold">
        {t("daily")}
      </h2>
      <div
        role="img"
        aria-label={t("dailyLabel", { days: data.days })}
        className="border-border bg-surface flex h-40 items-end gap-1 rounded-xl border p-3"
      >
        {data.daily.map((day) => (
          <div
            key={day.day}
            title={`${format.dateTime(new Date(day.day), { day: "numeric", month: "short" })}: ${day.opens}`}
            className="bg-primary-600 min-h-px flex-1 rounded-t"
            style={{ height: `${(day.opens / max) * 100}%` }}
          />
        ))}
      </div>
    </section>
  );
}

export function StatsView() {
  const t = useTranslations("admin.stats");
  const locale = useLocale() as Locale;
  const [days, setDays] = useState<(typeof PERIODS)[number]>(7);
  const { data, error, isPending, refetch } = useQuery(adminQueries.stats(days));

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div role="group" aria-label={t("period")} className="flex gap-2">
        {PERIODS.map((period) => (
          <Chip key={period} selected={days === period} onClick={() => setDays(period)}>
            {t("lastDays", { days: period })}
          </Chip>
        ))}
      </div>
      {error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <Skeleton className="h-72" />
      ) : data.totals.opens === 0 && data.totals.downloads === 0 ? (
        <EmptyState icon={BarChart3}>{t("empty")}</EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          <Totals data={data} />
          <DailyBars data={data} />

          <section aria-labelledby="stats-books" className="flex flex-col gap-3">
            <h2 id="stats-books" className="text-lg font-semibold">
              {t("books")}
            </h2>
            <div className="border-border bg-surface overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm" data-testid="stats-books">
                <thead className="text-muted border-border border-b">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("book")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("opens")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("downloads")}</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {data.books.map((book) => (
                    <tr key={book.id}>
                      <td className="px-4 py-2">
                        <Link
                          href={adminPdfBookPath(book.id)}
                          className="text-link underline-offset-4 hover:underline"
                        >
                          {getLocalized(book.title, locale)}
                        </Link>
                        <span className="text-muted"> · {t("grade", { grade: book.grade })}</span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{book.opens}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{book.downloads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {data.top_pages.length > 0 && (
            <section aria-labelledby="stats-pages" className="flex flex-col gap-3">
              <h2 id="stats-pages" className="text-lg font-semibold">
                {t("topPages")}
              </h2>
              <div className="border-border bg-surface overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm" data-testid="stats-pages">
                  <thead className="text-muted border-border border-b">
                    <tr>
                      <th className="px-4 py-2 font-medium">{t("book")}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("page")}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("views")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {data.top_pages.map((row) => (
                      <tr key={`${row.book_id}-${row.page}`}>
                        <td className="px-4 py-2">{getLocalized(row.title, locale)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.page}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.views}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
