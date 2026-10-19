"use client";

import { Bookmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

import { Skeleton } from "@/components/ui/Skeleton";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useProgressRecorder } from "@/hooks/useProgressRecorder";
import { Link } from "@/lib/i18n/navigation";
import { catalogPath } from "@/lib/utils/routes";
import { TopicRow } from "./TopicRow";

/** Xatcho'pga olingan mavzular (eng yangisi birinchi); har birini olib tashlash mumkin. */
export function SavedList({ limit }: { limit?: number }) {
  const t = useTranslations("cabinet.saved");
  const tc = useTranslations("cabinet");
  const record = useProgressRecorder();
  const { data: bookmarks, isPending } = useBookmarks();

  if (isPending) return <Skeleton className="h-16 w-full" />;
  if (!bookmarks || bookmarks.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        action={
          // Bosh sahifadagi kichik panelda tugma yo'q: sahifada asosiy harakat allaqachon bor
          limit === undefined ? (
            <Link
              href={catalogPath("kabinet")}
              className={buttonVariants({ variant: "secondary" })}
            >
              {tc("browse")}
            </Link>
          ) : undefined
        }
      >
        {t("empty")}
      </EmptyState>
    );
  }

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
