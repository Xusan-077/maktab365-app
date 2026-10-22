"use client";

import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { PdfBookCard } from "@/components/pdf/PdfBookCard";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { isBookRead, usePdfProgressMap } from "@/hooks/usePdfProgressMap";
import { Link } from "@/lib/i18n/navigation";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { catalogPath } from "@/lib/utils/routes";
import { EmptyText } from "./Panel";

/** Saqlangan darsliklar (eng yangisi birinchi). `limit` — bosh sahifadagi kichik panel uchun. */
export function SavedBooks({ limit }: { limit?: number }) {
  const t = useTranslations("library.saved");
  const { signedIn } = useAuth();
  const resume = usePdfProgressMap();
  const { data, isPending, isError } = useQuery({ ...pdfQueries.bookmarks(), enabled: signedIn });

  if (isError) return <EmptyText>{t("loadFailed")}</EmptyText>;
  if (isPending) return <Skeleton className="h-24 w-full" />;
  if (data.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        action={
          limit === undefined ? (
            <Link href={catalogPath()} className={buttonVariants({ variant: "secondary" })}>
              {t("browse")}
            </Link>
          ) : undefined
        }
      >
        {t("empty")}
      </EmptyState>
    );
  }
  return (
    <ul
      className={
        limit === undefined
          ? "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
          : "grid gap-3 sm:grid-cols-2"
      }
      data-testid="saved-books"
    >
      {data.slice(0, limit).map(({ book }) => (
        <li key={book.id}>
          <PdfBookCard
            layout={limit === undefined ? "column" : "row"}
            book={book}
            resumePage={resume[book.id]?.page}
            read={isBookRead(resume[book.id], book.page_count)}
          />
        </li>
      ))}
    </ul>
  );
}
