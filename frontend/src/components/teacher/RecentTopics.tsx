"use client";

import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import { TopicRow } from "@/components/cabinet/TopicRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { useRecentVisits } from "@/hooks/useRecentVisits";
import { TopicSaveButton } from "./SaveButtons";

/** Yaqinda ochilgan mavzular (shu qurilmada saqlanadi). */
export function RecentTopics({ limit }: { limit?: number }) {
  const t = useTranslations("teacher.recent");
  const visits = useRecentVisits();

  if (visits.length === 0) return <EmptyState icon={History}>{t("empty")}</EmptyState>;
  return (
    <ul className="flex flex-col gap-4">
      {visits.slice(0, limit).map((visit) => (
        <li key={visit.topicId}>
          <TopicRow
            topicId={visit.topicId}
            action={(title) => <TopicSaveButton topicId={visit.topicId} title={title} />}
          />
        </li>
      ))}
    </ul>
  );
}
