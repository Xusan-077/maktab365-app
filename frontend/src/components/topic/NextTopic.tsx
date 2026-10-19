"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { useAppPaths } from "@/hooks/useAppPaths";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import type { TopicSummary } from "@/types/catalog";

/** "Keyingi mavzu" va "Kitobga qaytish": havolalar joriy bazaga (marketing | kabinet | ustoz) ketadi. */
export function NextTopic({
  bookId,
  next,
  locale,
}: {
  bookId: string;
  next: TopicSummary | null;
  locale: Locale;
}) {
  const t = useTranslations("topic.next");
  const tb = useTranslations("book");
  const paths = useAppPaths();
  return (
    <nav aria-label={t("label")} className="flex flex-col items-start gap-3 print:hidden">
      {next ? (
        next.ready ? (
          <Link
            href={paths.topic(bookId, next.id)}
            className={buttonVariants({ size: "lg", className: "h-auto min-h-12 py-3" })}
          >
            <span className="text-left">
              <span className="block text-xs font-normal opacity-90">{t("title")}</span>
              <span className="block">{getLocalized(next.title, locale)}</span>
            </span>
            <ArrowRight className="size-5 shrink-0" aria-hidden />
          </Link>
        ) : (
          <p className="text-muted flex flex-wrap items-center gap-2">
            {t("title")}: {getLocalized(next.title, locale)}
            <Badge variant="accent">{tb("soon")}</Badge>
          </p>
        )
      ) : (
        <p className="text-muted">{t("last")}</p>
      )}
      <Link href={paths.book(bookId)} className="text-link rounded-md text-sm hover:underline">
        {t("toBook")}
      </Link>
    </nav>
  );
}
