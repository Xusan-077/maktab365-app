import { Circle, CircleCheck, CircleDot } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import type { ReadStatus } from "@/types/progress";

const icons = {
  none: { Icon: Circle, className: "text-muted" },
  started: { Icon: CircleDot, className: "text-link" },
  completed: { Icon: CircleCheck, className: "text-success" },
} as const;

/** Mavzuning o'qilganlik belgisi. Progress ulanmaguncha doim "o'qilmagan" ko'rsatiladi. */
export function TopicStatusMark({ status = "none" }: { status?: ReadStatus }) {
  const t = useTranslations("topicStatus");
  const { Icon, className } = icons[status];
  return <Icon role="img" aria-label={t(status)} className={cn("size-5 shrink-0", className)} />;
}
