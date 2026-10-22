"use client";

import { useQuery } from "@tanstack/react-query";
import { BookCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { PdfBookCard } from "@/components/pdf/PdfBookCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "@/lib/i18n/navigation";
import type { PdfLibraryItem } from "@/lib/pdf-books/api";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { catalogPath } from "@/lib/utils/routes";
import { EmptyText, Panel } from "./Panel";

function BookGrid({ items, testId }: { items: PdfLibraryItem[]; testId: string }) {
  return (
    <ul
      data-testid={testId}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
    >
      {items.map((item) => (
        <li key={item.book.id}>
          <PdfBookCard
            book={item.book}
            resumePage={item.last_page}
            read={item.read_status === "read"}
          />
        </li>
      ))}
    </ul>
  );
}

/** Natijalar: yaxshi o'zlashtirilgan (oxirigacha o'qilgan), jarayondagi va takrorlash kerak kitoblar. */
export function ResultsView() {
  const t = useTranslations("library.results");
  const { signedIn } = useAuth();
  const { data, isPending, isError } = useQuery({ ...pdfQueries.results(), enabled: signedIn });

  return (
    <div className={PAGE_STACK}>
      <PageHeader title={t("title")} description={t("lead")} />
      {isPending ? (
        <Skeleton className="h-44 w-full rounded-xl" />
      ) : isError ? (
        <EmptyText>{t("loadFailed")}</EmptyText>
      ) : data.read.length + data.in_progress.length === 0 ? (
        <EmptyState
          icon={BookCheck}
          action={
            <Link href={catalogPath()} className={buttonVariants({ variant: "secondary" })}>
              {t("browse")}
            </Link>
          }
        >
          {t("empty")}
        </EmptyState>
      ) : (
        <>
          {data.review.length > 0 && (
            <Panel
              title={t("review.title")}
              note={t("review.note", { days: data.review_after_days })}
            >
              <BookGrid items={data.review} testId="results-review" />
            </Panel>
          )}
          <Panel title={t("read.title")} note={t("read.note")}>
            {data.read.length > 0 ? (
              <BookGrid items={data.read} testId="results-read" />
            ) : (
              <EmptyText>{t("read.empty")}</EmptyText>
            )}
          </Panel>
          <Panel title={t("inProgress.title")} note={t("inProgress.note")}>
            {data.in_progress.length > 0 ? (
              <BookGrid items={data.in_progress} testId="results-in-progress" />
            ) : (
              <EmptyText>{t("inProgress.empty")}</EmptyText>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
