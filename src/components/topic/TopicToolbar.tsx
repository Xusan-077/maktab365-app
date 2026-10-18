"use client";

import { Bookmark, BookmarkCheck, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { TextSizeControl } from "@/components/layout/TextSizeControl";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useIsBookmarked } from "@/hooks/useBookmarks";
import { useProgressRecorder } from "@/hooks/useProgressRecorder";
import { useToast } from "@/hooks/useToast";

/** Xatcho'p, chop etish va matn hajmi. Xatcho'p hodisa sifatida yoziladi: mehmonda qurilmada, akkauntda oflayn navbat orqali. */
export function TopicToolbar({ topicId }: { topicId: string }) {
  const t = useTranslations("topic.toolbar");
  const { toast } = useToast();
  const { signedIn } = useAuth();
  const record = useProgressRecorder();
  const bookmarked = useIsBookmarked(topicId);

  const onBookmark = () => {
    const added = !bookmarked;
    record({ type: "bookmark_toggled", topicId, bookmarked: added });
    toast({
      variant: "success",
      title: added ? t("bookmarkAdded") : t("bookmarkRemoved"),
      ...(added && !signedIn && { description: t("bookmarkGuestHint") }),
    });
  };

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="present:hidden flex flex-wrap items-center gap-2 print:hidden"
    >
      <Button
        variant={bookmarked ? "accent" : "secondary"}
        aria-pressed={bookmarked}
        onClick={onBookmark}
      >
        {bookmarked ? (
          <BookmarkCheck className="size-4" aria-hidden />
        ) : (
          <Bookmark className="size-4" aria-hidden />
        )}
        {bookmarked ? t("bookmarked") : t("bookmark")}
      </Button>
      <Button variant="secondary" onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden />
        {t("print")}
      </Button>
      <TextSizeControl />
    </div>
  );
}
