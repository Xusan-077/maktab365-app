"use client";

import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import { TopicRow } from "@/components/cabinet/TopicRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTeacherDashboard } from "@/hooks/useTeacherDashboard";
import { TopicSaveButton } from "./SaveButtons";

/** Yaqinda ochilgan mavzular: server (`teacher/dashboard`) saqlaydi, shuning uchun qurilmalar bo'ylab bir xil. */
export function RecentTopics({ limit }: { limit?: number }) {
  const t = useTranslations("teacher.recent");
  const { data: dashboard, isPending } = useTeacherDashboard();

  if (isPending) return <Skeleton className="h-16 w-full" />;
  const visits = dashboard?.recent ?? [];
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
