"use client";

import { ChartNoAxesColumn } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

import { Skeleton } from "@/components/ui/Skeleton";
import { useResults } from "@/hooks/useResults";
import { Link } from "@/lib/i18n/navigation";
import { catalogPath } from "@/lib/utils/routes";
import { sectionDomId } from "@/lib/utils/topic-sections";
import type { Progress, ResultGroup } from "@/types/progress";
import { EmptyText } from "./Panel";
import { ProgressStatus } from "./ProgressStatus";
import { TopicRow } from "./TopicRow";

const CABINET_CATALOG = catalogPath("kabinet");

const GROUPS: ResultGroup[] = ["review", "inProgress", "mastered"];

function ResultSection({ mastery, items }: { mastery: ResultGroup; items: Progress[] }) {
  const t = useTranslations(`cabinet.results.${mastery}`);
  return (
    <section aria-labelledby={`results-${mastery}`} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id={`results-${mastery}`} className="text-xl font-semibold">
          {t("title")} <span className="text-muted font-normal tabular-nums">({items.length})</span>
        </h2>
        <p className="text-muted text-sm">{t("text")}</p>
      </div>
      {items.length === 0 ? (
        <EmptyText>{t("empty")}</EmptyText>
      ) : (
        <ul className="divide-border border-border bg-surface flex flex-col divide-y rounded-xl border">
          {items.map((item) => (
            <li key={item.topicId} className="p-4">
              <TopicRow
                topicId={item.topicId}
                hash={mastery === "review" ? `#${sectionDomId("exercise")}` : undefined}
              >
                <ProgressStatus progress={item} />
              </TopicRow>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * "Natijalar": umumiy foiz emas, mavzu kesimida — takrorlash kerak, jarayonda va yaxshi o'zlashtirilgan.
 * Har mavzuda "Mavzuni o'qidim" va "Mashqlardan o'tdim" alohida ko'rsatiladi.
 */
export function ResultsView() {
  const t = useTranslations("cabinet.results");
  const tc = useTranslations("cabinet");
  const { data: groups, isPending, isError } = useResults();

  const total = groups
    ? groups.counts.mastered + groups.counts.review + groups.counts.inProgress
    : 0;

  return (
    <div className={PAGE_STACK}>
      <PageHeader title={t("title")} description={t("lead")} />

      {isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : isError || !groups ? (
        <EmptyText>{tc("loadFailed")}</EmptyText>
      ) : total === 0 ? (
        <EmptyState
          icon={ChartNoAxesColumn}
          action={
            <Link href={CABINET_CATALOG} className={buttonVariants()}>
              {tc("browse")}
            </Link>
          }
        >
          {t("emptyText")}
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="font-medium">
              {t("summary", {
                mastered: groups.counts.mastered,
                review: groups.counts.review,
                progress: groups.counts.inProgress,
              })}
            </p>
            <p className="text-muted text-sm">{t("statesNote")}</p>
          </div>
          {GROUPS.map((mastery) => (
            <ResultSection key={mastery} mastery={mastery} items={groups[mastery]} />
          ))}
        </>
      )}
    </div>
  );
}
