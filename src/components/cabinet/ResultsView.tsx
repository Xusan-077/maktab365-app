"use client";

import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useProgress } from "@/hooks/useProgress";
import { Link } from "@/lib/i18n/navigation";
import { groupByMastery, type Mastery } from "@/lib/progress/review";
import { catalogPath } from "@/lib/utils/routes";
import { sectionDomId } from "@/lib/utils/topic-sections";
import type { Progress } from "@/types/progress";
import { EmptyText } from "./Panel";
import { ProgressStatus } from "./ProgressStatus";
import { TopicRow } from "./TopicRow";

const CABINET_CATALOG = catalogPath("kabinet");

const GROUPS: Mastery[] = ["review", "inProgress", "mastered"];

function ResultGroup({ mastery, items }: { mastery: Mastery; items: Progress[] }) {
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
  const { data: progress, isPending, isError } = useProgress();

  const groups = groupByMastery(progress ?? []);
  const total = groups.mastered.length + groups.review.length + groups.inProgress.length;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted">{t("lead")}</p>
      </header>

      {isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : isError ? (
        <EmptyText>{tc("loadFailed")}</EmptyText>
      ) : total === 0 ? (
        <section className="border-border bg-surface flex flex-col items-start gap-3 rounded-xl border p-6">
          <h2 className="text-2xl font-semibold tracking-tight">{t("emptyTitle")}</h2>
          <EmptyText>{t("emptyText")}</EmptyText>
          <Link href={CABINET_CATALOG} className={buttonVariants({ size: "lg" })}>
            {tc("browse")}
          </Link>
        </section>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="font-medium">
              {t("summary", {
                mastered: groups.mastered.length,
                review: groups.review.length,
                progress: groups.inProgress.length,
              })}
            </p>
            <p className="text-muted text-sm">{t("statesNote")}</p>
          </div>
          {GROUPS.map((mastery) => (
            <ResultGroup key={mastery} mastery={mastery} items={groups[mastery]} />
          ))}
        </>
      )}
    </div>
  );
}
