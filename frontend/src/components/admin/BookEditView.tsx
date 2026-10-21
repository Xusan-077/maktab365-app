"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminQueries } from "@/lib/admin/queries";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { BookForm } from "./BookForm";
import { BookTree } from "./BookTree";
import { QueryError } from "./QueryError";
import { BookStatusBadge } from "./StatusBadge";

/** Kitob sahifasi: ma'lumotlar formasi va boblar/mavzular daraxti. */
export function BookEditView({ id }: { id: string }) {
  const t = useTranslations("admin.bookForm");
  const locale = useLocale() as Locale;
  const { data: book, error, isPending, refetch } = useQuery(adminQueries.book(id));

  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;
  if (isPending) return <Skeleton className="h-96" />;

  return (
    <>
      <PageHeader
        title={getLocalized(book.title, locale)}
        description={book.slug}
        action={<BookStatusBadge published={Boolean(book.is_published)} />}
      />
      <Link
        href={ADMIN_ROUTES.books}
        className="text-link -mt-4 text-sm font-medium underline-offset-4 hover:underline"
      >
        {t("backToList")}
      </Link>
      {/* `key`: saqlangandan keyin forma server qiymatlari bilan qayta quriladi (isDirty tozalanadi). */}
      <BookForm key={book.updated_at} book={book} />
      <BookTree bookId={book.id} />
    </>
  );
}

/** Yangi kitob sahifasi. */
export function BookCreateView() {
  const t = useTranslations("admin.bookForm");
  return (
    <>
      <PageHeader title={t("createTitle")} description={t("createDescription")} />
      <BookForm />
    </>
  );
}
