import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BooksFilterBar } from "@/components/books/BooksFilterBar";
import { BooksResults, BooksResultsSkeleton } from "@/components/books/BooksResults";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { bookQuery, parseBookFilters } from "@/lib/books/filters";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { ROUTES } from "@/lib/utils/routes";

type Props = PageProps<"/[locale]/kitoblar">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "books" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: getAlternates(locale, ROUTES.books),
  };
}

/** `params` va `searchParams` faqat `<Suspense>` ichida o'qiladi (App Shell bitta URL'ga bog'lanmasin). */
export default function BooksPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<BooksPageFallback />}>
      <BooksContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const SHELL =
  "max-w-site mx-auto flex w-full flex-col gap-8 px-4 pt-10 pb-20 sm:px-8 sm:pt-12 sm:pb-24";

function BooksPageFallback() {
  return (
    <div className={SHELL}>
      <div className="bg-surface-2 h-12 w-48 animate-pulse rounded-lg" />
      <BooksResultsSkeleton />
    </div>
  );
}

async function BooksContent({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const filters = parseBookFilters(await searchParams);
  const t = await getTranslations({ locale, namespace: "books" });
  const tn = await getTranslations({ locale, namespace: "nav" });

  return (
    <div className={SHELL}>
      <div className="flex flex-col gap-2.5">
        <Breadcrumbs items={[{ label: tn("home"), href: ROUTES.home }, { label: t("title") }]} />
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] sm:text-[2.75rem]">
          {t("title")}
        </h1>
      </div>
      <BooksFilterBar key={bookQuery(filters)} filters={filters} />
      <Suspense key={bookQuery(filters)} fallback={<BooksResultsSkeleton />}>
        <BooksResults filters={filters} />
      </Suspense>
    </div>
  );
}
