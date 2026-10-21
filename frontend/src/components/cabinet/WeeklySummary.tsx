"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDashboard } from "@/hooks/useDashboard";
import { EmptyText } from "./Panel";

/** Oxirgi 7 kun: tugatilgan mavzular va mashq natijalari (umumiy foiz emas, aniq sonlar). */
export function WeeklySummary() {
  const t = useTranslations("cabinet.weekly");
  const { data: dashboard, isPending } = useDashboard();

  if (isPending) return <Skeleton className="h-20 w-full" />;
  const summary = dashboard?.weekly;
  if (!summary || summary.active === 0) return <EmptyText>{t("empty")}</EmptyText>;

  const rows = [
    { key: "finished", value: summary.finished },
    { key: "read", value: summary.read },
    { key: "passed", value: summary.exercisesPassed },
    { key: "mistakes", value: summary.mistakes },
  ] as const;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {rows.map((row) => (
        <div key={row.key} className="flex flex-col-reverse gap-0.5">
          <dt className="text-muted text-sm">{t(row.key)}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
