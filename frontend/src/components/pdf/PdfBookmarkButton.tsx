"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { usePdfBookmarks } from "@/hooks/usePdfBookmarks";

/** "Saqlash" / "Saqlangan": kitobni saqlanganlarga qo'shadi yoki olib tashlaydi. */
export function PdfBookmarkButton({ bookId }: { bookId: string }) {
  const t = useTranslations("pdfBooks.bookmark");
  const { ready, isSaved, setSaved, pending } = usePdfBookmarks();
  const saved = isSaved(bookId);
  return (
    <Button
      variant={saved ? "primary" : "secondary"}
      size="sm"
      aria-pressed={saved}
      disabled={!ready || pending}
      data-testid="pdf-bookmark"
      onClick={() => setSaved(bookId, !saved)}
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
