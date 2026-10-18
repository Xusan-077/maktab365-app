"use client";

import { useTranslations } from "next-intl";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useChapters } from "@/hooks/useChapters";
import { useProgress } from "@/hooks/useProgress";

/** Kitobdagi o'qilgan mavzular soni (progressning yagona manbasidan); hali boshlanmagan bo'lsa ko'rinmaydi. */
export function BookReadProgress({ bookId, title }: { bookId: string; title: string }) {
  const t = useTranslations("catalog");
  const { data: chapters } = useChapters(bookId);
  const { data: progress } = useProgress();

  if (!chapters || !progress) return null;
  const topics = chapters.flatMap((chapter) => chapter.topics).filter((topic) => topic.ready);
  const own = progress.filter((item) => topics.some((topic) => topic.id === item.topicId));
  const done = own.filter((item) => item.readStatus === "completed").length;
  if (topics.length === 0 || own.every((item) => item.readStatus === "none")) return null;

  return (
    <div className="flex max-w-xs flex-col gap-1">
      <ProgressBar value={done} max={topics.length} label={t("readProgressLabel", { title })} />
      <p className="text-muted text-sm">{t("readProgress", { done, total: topics.length })}</p>
    </div>
  );
}
