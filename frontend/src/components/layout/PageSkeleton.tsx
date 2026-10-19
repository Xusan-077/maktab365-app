"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";
import { READING_WIDTH } from "./containers";

const LIST_ITEMS = 4;
const READING_LINES = 7;

export type PageSkeletonVariant = "list" | "reading" | "form";

/** loading.tsx uchun: sarlavha + sahifa turiga mos kontent skeleti. Konteyner kengligini layout beradi. */
export function PageSkeleton({ variant = "list" }: { variant?: PageSkeletonVariant }) {
  const t = useTranslations("ui");
  return (
    <div role="status" aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-2/3 max-w-sm" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      {variant === "list" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: LIST_ITEMS }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      )}
      {variant === "reading" && (
        <div className={cn("flex flex-col gap-3", READING_WIDTH)}>
          {Array.from({ length: READING_LINES }, (_, index) => (
            <Skeleton key={index} className={cn("h-4", index % 4 === 3 ? "w-2/3" : "w-full")} />
          ))}
        </div>
      )}
      {variant === "form" && (
        <div className="flex max-w-xl flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-40" />
        </div>
      )}
    </div>
  );
}
