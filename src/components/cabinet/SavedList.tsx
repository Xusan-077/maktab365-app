"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useProgressRecorder } from "@/hooks/useProgressRecorder";
import { EmptyText } from "./Panel";
import { TopicRow } from "./TopicRow";

/** Xatcho'pga olingan mavzular (eng yangisi birinchi); har birini olib tashlash mumkin. */
export function SavedList({ limit }: { limit?: number }) {
  const t = useTranslations("cabinet.saved");
  const record = useProgressRecorder();
  const { data: bookmarks, isPending } = useBookmarks();

  if (isPending) return <Skeleton className="h-16 w-full" />;
  if (!bookmarks || bookmarks.length === 0) return <EmptyText>{t("empty")}</EmptyText>;

  const items = [...bookmarks]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.id}>
          <TopicRow
            topicId={item.topicId}
            action={(title) => (
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("remove", { topic: title })}
                onClick={() =>
                  record({ type: "bookmark_toggled", topicId: item.topicId, bookmarked: false })
                }
              >
                {t("removeAction")}
              </Button>
            )}
          />
        </li>
      ))}
    </ul>
  );
}
