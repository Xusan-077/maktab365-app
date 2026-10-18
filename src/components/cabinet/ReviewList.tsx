"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useProgress } from "@/hooks/useProgress";
import { sectionDomId } from "@/lib/utils/topic-sections";
import { reviewTopics } from "@/lib/progress/review";
import { EmptyText } from "./Panel";
import { ProgressStatus } from "./ProgressStatus";
import { TopicRow } from "./TopicRow";

/** Takrorlash kerak mavzular: mashqlarda xato qilingan mavzular, mashqlar bo'limiga havola bilan. */
export function ReviewList({ limit }: { limit?: number }) {
  const t = useTranslations("cabinet.review");
  const { data: progress, isPending } = useProgress();

  if (isPending) return <Skeleton className="h-16 w-full" />;
  const review = reviewTopics(progress ?? []);
  if (review.length === 0) return <EmptyText>{t("empty")}</EmptyText>;

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
