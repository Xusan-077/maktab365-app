import { useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { TopicStatus } from "@/lib/admin/types";

const TOPIC_VARIANTS: Record<TopicStatus, BadgeVariant> = {
  draft: "neutral",
  reviewed: "accent",
  published: "success",
};

/** Mavzu holati nishoni: qoralama · tekshirildi · nashr qilingan. */
export function TopicStatusBadge({ status }: { status: TopicStatus }) {
  const t = useTranslations("admin.status");
  return <Badge variant={TOPIC_VARIANTS[status]}>{t(status)}</Badge>;
}

/** Kitob ko'rinishi: ochiq (nashr qilingan) yoki yashirin. */
export function BookStatusBadge({ published }: { published: boolean }) {
  const t = useTranslations("admin.bookStatus");
  return (
    <Badge variant={published ? "success" : "neutral"}>
      {t(published ? "published" : "draft")}
    </Badge>
  );
}
