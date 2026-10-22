"use client";

import { useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { catalogPath } from "@/lib/utils/routes";
import { EmptyText } from "./Panel";

/** Fanlarim: o'qiy boshlangan fanlar va ulardagi o'qilgan kitoblar ulushi. */
export function SubjectsView() {
  const t = useTranslations("library.subjects");
  const locale = useLocale() as Locale;
  const { signedIn } = useAuth();
  const { data, isPending, isError } = useQuery({ ...pdfQueries.dashboard(), enabled: signedIn });

  return (
    <div className={PAGE_STACK}>
      <PageHeader title={t("pageTitle")} description={t("lead")} />
      {isPending ? (
        <Skeleton className="h-44 w-full rounded-xl" />
      ) : isError ? (
        <EmptyText>{t("loadFailed")}</EmptyText>
      ) : data.subjects.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          action={
            <Link href={catalogPath()} className={buttonVariants({ variant: "secondary" })}>
              {t("browse")}
            </Link>
          }
        >
          {t("empty")}
        </EmptyState>
      ) : (
        <ul data-testid="subjects-list" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.subjects.map((subject) => {
            const title = getLocalized(subject.title, locale);
            return (
              <li
                key={subject.slug}
                className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-5"
              >
                <div className="flex flex-col gap-1">
                  <Link
                    href={`${catalogPath()}?subject=${subject.slug}`}
                    className="text-lg font-semibold hover:underline"
                  >
                    {title}
                  </Link>
                  <p className="text-muted text-sm tabular-nums">
                    {t("opened", { opened: subject.books_opened, total: subject.books_total })}
                  </p>
                </div>
                <ProgressBar
                  value={subject.books_read}
                  max={Math.max(subject.books_total, 1)}
                  label={title}
                />
                <p className="text-muted text-sm tabular-nums">
                  {t("progress", { read: subject.books_read, total: subject.books_total })}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
