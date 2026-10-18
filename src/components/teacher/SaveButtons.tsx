"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useBookBookmarks } from "@/hooks/useBookBookmarks";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useMe } from "@/hooks/useMe";
import { useToast } from "@/hooks/useToast";
import { useToggleBookBookmark } from "@/hooks/useToggleBookBookmark";
import { useProgressRecorder } from "@/hooks/useProgressRecorder";

interface SaveToggleProps {
  saved: boolean;
  pending: boolean;
  /** Ekran o'qigichlar uchun to'liq nom (masalan, "{title} — saqlash"). */
  label: string;
  onToggle: () => void;
}

function SaveToggle({ saved, pending, label, onToggle }: SaveToggleProps) {
  const t = useTranslations("teacher.save");
  return (
    <Button
      variant={saved ? "accent" : "secondary"}
      size="sm"
      aria-pressed={saved}
      aria-label={label}
      loading={pending}
      onClick={onToggle}
    >
      {saved ? (
        <BookmarkCheck className="size-4" aria-hidden />
      ) : (
        <Bookmark className="size-4" aria-hidden />
      )}
      {saved ? t("saved") : t("save")}
    </Button>
  );
}

/** Kitobni saqlash. `teacherOnly` — ommaviy sahifalarda faqat o'qituvchiga ko'rinadi. */
export function BookSaveButton({
  bookId,
  title,
  teacherOnly = false,
}: {
  bookId: string;
  title: string;
  teacherOnly?: boolean;
}) {
  const t = useTranslations("teacher.save");
  const { toast } = useToast();
  const { signedIn } = useAuth();
  const { data: me } = useMe();
  const { data: saved } = useBookBookmarks();
  const { mutate, isPending } = useToggleBookBookmark();

  if (!signedIn || (teacherOnly && me?.role !== "teacher")) return null;
  const isSaved = Boolean(saved?.some((item) => item.bookId === bookId));

  return (
    <SaveToggle
      saved={isSaved}
      pending={isPending}
      label={t(isSaved ? "removeLabel" : "saveLabel", { title })}
      onToggle={() =>
        mutate(bookId, {
          onSuccess: (result) =>
            toast({ variant: "success", title: t(result.bookmarked ? "added" : "removed") }),
          onError: () => toast({ variant: "error", title: t("error") }),
        })
      }
    />
  );
}

/** Mavzuni saqlash (akkaunt xatcho'pi — mavzu sahifasidagi tugma bilan bir xil ro'yxat). */
export function TopicSaveButton({ topicId, title }: { topicId: string; title: string }) {
  const t = useTranslations("teacher.save");
  const { toast } = useToast();
  const record = useProgressRecorder();
  const { data: saved } = useBookmarks();
  const isSaved = Boolean(saved?.some((item) => item.topicId === topicId));

  return (
    <SaveToggle
      saved={isSaved}
      pending={false}
      label={t(isSaved ? "removeLabel" : "saveLabel", { title })}
      onToggle={() => {
        record({ type: "bookmark_toggled", topicId, bookmarked: !isSaved });
        toast({ variant: "success", title: t(isSaved ? "removed" : "added") });
      }}
    />
  );
}
