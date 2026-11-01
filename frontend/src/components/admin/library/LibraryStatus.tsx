import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import type { AdminBook } from "@/lib/library/admin-api";

/** Kitob holati: PDF yo'q / tayyor (yuklash sinxron, "tayyorlanmoqda" holati yo'q). */
export function LibraryStatusBadge({ book }: { book: AdminBook }) {
  const t = useTranslations("admin.library.status");
  if (!book.has_file) return <Badge>{t("noFile")}</Badge>;
  if (book.status === "failed") return <Badge variant="danger">{t("failed")}</Badge>;
  return <Badge variant="success">{t("ready")}</Badge>;
}
