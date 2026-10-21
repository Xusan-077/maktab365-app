"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDashboard } from "@/hooks/useDashboard";
import { sectionDomId } from "@/lib/utils/topic-sections";
import { ProgressStatus } from "./ProgressStatus";
import { TopicRow } from "./TopicRow";

/** Takrorlash kerak mavzular: mashqlarda xato qilingan mavzular, mashqlar bo'limiga havola bilan. */
export function ReviewList({ limit }: { limit?: number }) {
  const t = useTranslations("cabinet.review");
  const { data: dashboard, isPending } = useDashboard();

  if (isPending) return <Skeleton className="h-16 w-full" />;
  const review = dashboard?.review.items ?? [];
  if (review.length === 0) return <EmptyState icon={CircleCheck}>{t("empty")}</EmptyState>;

  return (
    <ul className="flex flex-col gap-4">
      {review.slice(0, limit).map((item) => (
        <li key={item.topicId}>
          <TopicRow topicId={item.topicId} hash={`#${sectionDomId("exercise")}`}>
            <ProgressStatus progress={item} />
          </TopicRow>
        </li>
      ))}
    </ul>
  );
}
