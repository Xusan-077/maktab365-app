"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePdfBookmarks } from "@/hooks/usePdfBookmarks";
import { cn } from "@/lib/utils/cn";

/** Dizayndagi 56px kvadrat "Saqlash" tugmasi (ikonka); saqlangan bo'lsa to'ldirilgan. */
export function BookSaveButton({ bookId }: { bookId: string }) {
  const t = useTranslations("pdfBooks.bookmark");
  const { ready, isSaved, setSaved } = usePdfBookmarks();
  const saved = isSaved(bookId);
  return (
    <button
      type="button"
      aria-label={saved ? t("saved") : t("save")}
      aria-pressed={saved}
      disabled={!ready}
      data-testid="pdf-bookmark"
      onClick={() => setSaved(bookId, !saved)}
      className={cn(
        "flex size-14 items-center justify-center rounded-2xl border-[1.5px] transition-colors disabled:opacity-50",
        saved
          ? "border-brand bg-brand-soft text-brand-text"
          : "border-input-border bg-surface text-foreground hover:bg-surface-2",
      )}
    >
      {saved ? (
        <BookmarkCheck className="size-5" aria-hidden />
      ) : (
        <Bookmark className="size-5" aria-hidden />
      )}
    </button>
  );
}
