"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { buttonVariants } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useMe } from "@/hooks/useMe";
import { useProgress } from "@/hooks/useProgress";
import { Link } from "@/lib/i18n/navigation";
import { groupByMastery, hasActivity, pickContinue } from "@/lib/progress/review";
import { catalogPath, ROUTES } from "@/lib/utils/routes";
import { ContinueCard } from "./ContinueCard";
import { EmptyText, Panel } from "./Panel";
import { ReviewList } from "./ReviewList";
import { SavedList } from "./SavedList";
import { StudyPlan } from "./StudyPlan";
import { SubjectsList } from "./SubjectsList";
import { WeeklySummary } from "./WeeklySummary";

const CABINET_CATALOG = catalogPath("kabinet");

const DASHBOARD_LIST_LIMIT = 4;

/** Davom ettirish kartochkasi o'rnida: hali hech narsa boshlanmagan yoki hammasi tugagan holat. */
function StartCard({ finished }: { finished: boolean }) {
  const t = useTranslations("cabinet.continue");
  const tc = useTranslations("cabinet");
  const { data: me } = useMe();
  const grade = me?.role === "student" ? me.grade : undefined;
  const href = grade === undefined ? CABINET_CATALOG : `${CABINET_CATALOG}?grade=${grade}`;
  return (
    <section className="border-border bg-surface flex flex-col items-start gap-3 rounded-xl border p-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        {finished ? t("doneTitle") : t("emptyTitle")}
      </h2>
      <EmptyText>{finished ? t("doneText") : t("emptyText")}</EmptyText>
      <Link href={href} className={buttonVariants({ size: "lg" })}>
        {tc("browse")}
      </Link>
    </section>
  );
}

/** O'quvchi kabineti: shaxsiy o'qish sahifasi (davom ettirish, takrorlash, saqlanganlar, natija, reja). */
export function CabinetView() {
  const t = useTranslations("cabinet");
  const { data: me } = useMe();
  const { data: progress, isPending, isError } = useProgress();
  const { data: bookmarks } = useBookmarks();

  const next = progress ? pickContinue(progress) : undefined;
  const hasProgress = progress?.some(hasActivity) ?? false;
  const reviewCount = progress ? groupByMastery(progress).review.length : 0;

  return (
    <div className={PAGE_STACK}>
      <PageHeader title={t("greeting", { name: me?.name ?? "" })} description={t("lead")} />

      {isPending ? (
        <Skeleton className="h-44 w-full rounded-xl" />
      ) : isError ? (
        <EmptyText>{t("loadFailed")}</EmptyText>
      ) : next ? (
        <ContinueCard progress={next} />
      ) : (
        <StartCard finished={hasProgress} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t("subjects.title")}
          footer={
            <Link href={ROUTES.cabinetSubjects} className="text-link hover:underline">
              {t("subjects.all")}
            </Link>
          }
        >
          <SubjectsList limit={DASHBOARD_LIST_LIMIT} />
        </Panel>
        <Panel
          title={t("review.title")}
          footer={
            reviewCount > DASHBOARD_LIST_LIMIT && (
              <Link href={ROUTES.cabinetResults} className="text-link hover:underline">
                {t("review.all", { count: reviewCount })}
              </Link>
            )
          }
        >
          <ReviewList limit={DASHBOARD_LIST_LIMIT} />
        </Panel>
        <Panel
          title={t("saved.title")}
          footer={
            (bookmarks?.length ?? 0) > DASHBOARD_LIST_LIMIT && (
              <Link href={ROUTES.cabinetSaved} className="text-link hover:underline">
                {t("saved.all", { count: bookmarks?.length ?? 0 })}
              </Link>
            )
          }
        >
          <SavedList limit={DASHBOARD_LIST_LIMIT} />
        </Panel>
        <Panel
          title={t("weekly.title")}
          note={t("weekly.period")}
          footer={
            <Link href={ROUTES.cabinetResults} className="text-link hover:underline">
              {t("weekly.more")}
            </Link>
          }
        >
          <WeeklySummary />
        </Panel>
      </div>

      <Panel title={t("plan.title")}>
        <StudyPlan />
      </Panel>
    </div>
  );
}
