"use client";

import { useTopicProgress } from "@/hooks/useProgress";
import { TopicStatusMark } from "./TopicStatusMark";

/** Mavzuning "o'qilgan" belgisi: progressning yagona manbasidan (mehmon yoki akkaunt) o'qiladi. */
export function TopicReadMark({ topicId }: { topicId: string }) {
  const { data } = useTopicProgress(topicId);
  return <TopicStatusMark status={data?.readStatus ?? "none"} />;
}
