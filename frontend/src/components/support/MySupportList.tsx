"use client";

import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { apiQueries } from "@/lib/api/queries";
import type { SupportStatus } from "@/types/support";

const STATUS_VARIANT: Record<SupportStatus, BadgeVariant> = {
  new: "neutral",
  in_progress: "primary",
  resolved: "success",
  spam: "neutral",
};

/** "Mening xabarlarim": foydalanuvchining murojaatlari va ularning holati. */
export function MySupportList() {
  const t = useTranslations("support");
  const format = useFormatter();
  const { signedIn } = useAuth();
  const { data, isPending, isError } = useQuery({ ...apiQueries.mySupport(), enabled: signedIn });

  if (isError) return <p className="text-muted">{t("mine.loadFailed")}</p>;
  if (isPending) return <Skeleton className="h-20 w-full" />;
  if (data.length === 0) return <p className="text-muted">{t("mine.empty")}</p>;

  return (
    <ul data-testid="my-support" className="flex flex-col gap-3">
      {data.map((item) => (
        <li
          key={item.id}
          className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{t(`kinds.${item.kind}`)}</span>
            <Badge variant={STATUS_VARIANT[item.status]}>
              {t(`statuses.${item.status === "spam" ? "new" : item.status}`)}
            </Badge>
          </div>
          <p className="line-clamp-3 break-words whitespace-pre-line">{item.message}</p>
          <time dateTime={item.createdAt} className="text-muted text-xs">
            {format.dateTime(new Date(item.createdAt), { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </li>
      ))}
    </ul>
  );
}
