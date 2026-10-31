import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { AdminBook } from "@/lib/library/admin-api";

/** Sahifalarni tayyorlash holati: PDF yo'q / tayyorlanmoqda / tayyor / xato. */
export function LibraryStatusBadge({ book }: { book: AdminBook }) {
  const t = useTranslations("admin.library.status");
  if (!book.has_file) return <Badge>{t("noFile")}</Badge>;
  if (book.status === "processing") return <Badge variant="accent">{t("processing")}</Badge>;
  if (book.status === "failed") return <Badge variant="danger">{t("failed")}</Badge>;
  return <Badge variant="success">{t("ready")}</Badge>;
}

/** "37 / 120 bet" va ingichka chiziq (faqat tayyorlanayotganda). */
export function LibraryProgress({ book, className }: { book: AdminBook; className?: string }) {
  const t = useTranslations("admin.library");
  if (book.status !== "processing") return null;
  return (
    <div className={className}>
      <ProgressBar
        value={book.processed_pages}
        max={Math.max(1, book.page_count)}
        label={t("progressLabel")}
      />
      <p className="text-muted mt-1 text-xs tabular-nums" aria-live="polite">
        {t("progress", { done: book.processed_pages, total: book.page_count })}
      </p>
    </div>
  );
}
