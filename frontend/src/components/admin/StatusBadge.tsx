import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";

/** Kitob ko'rinishi: ochiq (nashr qilingan) yoki yashirin. */
export function BookStatusBadge({ published }: { published: boolean }) {
  const t = useTranslations("admin.bookStatus");
  return (
    <Badge variant={published ? "success" : "neutral"}>
      {t(published ? "published" : "draft")}
    </Badge>
  );
}
