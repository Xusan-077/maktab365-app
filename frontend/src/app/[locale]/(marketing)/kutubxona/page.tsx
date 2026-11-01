import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BooksFilterBar } from "@/components/books/BooksFilterBar";
import { BooksResults, BooksResultsSkeleton } from "@/components/books/BooksResults";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { bookQuery, parseBookFilters } from "@/lib/books/filters";
import { getBookTypes } from "@/lib/books/server";
import { SectionJsonLd } from "@/components/seo/SectionJsonLd";
import { routing } from "@/lib/i18n/routing";
import { buildMetadata, splitKeywords } from "@/lib/seo/metadata";
import { ROUTES } from "@/lib/utils/routes";

type Props = PageProps<"/[locale]/kutubxona">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "books" });
  const tm = await getTranslations({ locale, namespace: "meta" });
  return buildMetadata({
    locale,
    path: ROUTES.books,
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: splitKeywords(tm("libraryKeywords")),
  });
}

/** `params` va `searchParams` faqat `<Suspense>` ichida o'qiladi (App Shell bitta URL'ga bog'lanmasin). */
export default function LibraryPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<LibraryPageFallback />}>
      <LibraryContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const SHELL =
  "max-w-site mx-auto flex w-full flex-col gap-8 px-4 pt-10 pb-20 sm:px-8 sm:pt-12 sm:pb-24";

function LibraryPageFallback() {
  return (
    <div className={SHELL}>
      <div className="bg-surface-2 h-12 w-48 animate-pulse rounded-lg" />
      <BooksResultsSkeleton />
    </div>
  );
}

async function LibraryContent({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const filters = parseBookFilters(await searchParams);
  const [t, tn, allTypes] = await Promise.all([
    getTranslations({ locale, namespace: "books" }),
    getTranslations({ locale, namespace: "nav" }),
    getBookTypes(),
  ]);
  // Bo'sh turlar tab bo'lib chiqmaydi (tanlangan tur bo'sh bo'lsa ham ko'rinadi).
  const types = allTypes.filter((type) => type.book_count > 0 || type.slug === filters.type);

  return (
    <div className={SHELL}>
      <SectionJsonLd locale={locale} name={t("title")} path={ROUTES.books} />
      <div className="flex flex-col gap-2.5">
        <Breadcrumbs items={[{ label: tn("home"), href: ROUTES.home }, { label: t("title") }]} />
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] sm:text-[2.75rem]">
          {t("title")}
        </h1>
        <p className="text-muted max-w-[65ch] text-[1.0625rem]">{t("intro")}</p>
      </div>
      <BooksFilterBar filters={filters} types={types} />
      <Suspense key={`list:${bookQuery(filters)}`} fallback={<BooksResultsSkeleton />}>
        <BooksResults filters={filters} />
      </Suspense>
    </div>
  );
}
