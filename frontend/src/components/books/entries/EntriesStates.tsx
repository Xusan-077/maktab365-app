"use client";

import { BookOpen, LogIn, NotebookPen, SearchX, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";

export function EntriesSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-busy>
      {[0, 1, 2].map((item) => (
        <Skeleton key={item} className="h-40 w-full rounded-xl" />
      ))}
    </div>
  );
}

/** Hali hech narsa yozilmagan. */
export function EntriesEmpty() {
  const t = useTranslations("books.entries");
  return (
    <EmptyState
      icon={NotebookPen}
      action={
        <Link href={ROUTES.books} className={buttonVariants({ variant: "primary" })}>
          <BookOpen className="size-4" aria-hidden />
          {t("emptyAction")}
        </Link>
      }
    >
      {t("emptyText")}
    </EmptyState>
  );
}

/** Filtrga mos yozuv yo'q. */
export function EntriesNoMatch({ onReset }: { onReset: () => void }) {
  const t = useTranslations("books.entries");
  return (
    <EmptyState
      icon={SearchX}
      action={
        <Button variant="secondary" onClick={onReset}>
          {t("reset")}
        </Button>
      }
    >
      {t("noMatch")}
    </EmptyState>
  );
}

export function EntriesError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("books.entries");
  return (
    <EmptyState
      icon={TriangleAlert}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t("retry")}
        </Button>
      }
    >
      {t("errorText")}
    </EmptyState>
  );
}

/** Mehmon: yozuvlar akkauntga saqlanadi, shuning uchun kirishga taklif. */
export function EntriesGuest() {
  const t = useTranslations("books.entries");
  const requireAuth = useRequireAuth();
  return (
    <EmptyState
      icon={LogIn}
      action={
        <Button onClick={() => requireAuth(undefined, "note")}>
          <LogIn className="size-4" aria-hidden />
          {t("guestAction")}
        </Button>
      }
    >
      {t("guestText")}
    </EmptyState>
  );
}
