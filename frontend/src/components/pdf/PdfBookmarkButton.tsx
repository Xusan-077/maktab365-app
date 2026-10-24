"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { usePdfBookmarks } from "@/hooks/usePdfBookmarks";
import { cn } from "@/lib/utils/cn";

/** "Saqlash" / "Saqlangan": kitobni saqlanganlarga qo'shadi yoki olib tashlaydi. `compact` — kichik ekranda faqat ikonka. */
export function PdfBookmarkButton({
  bookId,
  compact = false,
}: {
  bookId: string;
  compact?: boolean;
}) {
  const t = useTranslations("pdfBooks.bookmark");
  const { ready, isSaved, setSaved } = usePdfBookmarks();
  const saved = isSaved(bookId);
  return (
    <Button
      variant={saved ? "primary" : "secondary"}
      size="sm"
      aria-pressed={saved}
      disabled={!ready}
      data-testid="pdf-bookmark"
      onClick={() => setSaved(bookId, !saved)}
      className={cn(compact && "max-lg:size-11 max-lg:border-0 max-lg:px-0 lg:h-11")}
    >
      {saved ? (
        <BookmarkCheck className="size-4" aria-hidden />
      ) : (
        <Bookmark className="size-4" aria-hidden />
      )}
      <span className={cn(compact && "max-lg:sr-only")}>{saved ? t("saved") : t("save")}</span>
    </Button>
  );
}
