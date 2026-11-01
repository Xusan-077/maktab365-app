import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogFilterSheet } from "@/components/catalog/CatalogFilterSheet";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { CatalogResults } from "@/components/catalog/CatalogResults";
import { CatalogResultsSkeleton, CatalogSkeleton } from "@/components/catalog/CatalogSkeleton";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { SectionJsonLd } from "@/components/seo/SectionJsonLd";
import { routing } from "@/lib/i18n/routing";
import { buildMetadata, splitKeywords } from "@/lib/seo/metadata";
import { catalogFiltersKey, parseCatalogFilters } from "@/lib/pdf/catalog-filters";
import { getGradeBooks } from "@/lib/pdf-books/server";
import { gradePath, ROUTES } from "@/lib/utils/routes";

type Props = PageProps<"/[locale]/darsliklar">;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const { grade } = parseCatalogFilters(await searchParams);
  // `?sinf=9` — sinf sahifasi o'rnidagi kanonik manzil (o'z sarlavhasi bilan); qolgan filtrlar katalogga kanonik.
  if (grade) {
    const [t, tm, books] = await Promise.all([
      getTranslations({ locale, namespace: "pdfBooks.grade.meta" }),
      getTranslations({ locale, namespace: "meta" }),
      getGradeBooks(grade),
    ]);
    return buildMetadata({
      locale,
      path: gradePath(grade),
      title: t("title", { grade }),
      description: t("description", { grade, count: books.length }),
      keywords: splitKeywords(tm("keywords")),
    });
  }
  const t = await getTranslations({ locale, namespace: "catalogPage" });
  const tm = await getTranslations({ locale, namespace: "meta" });
  return buildMetadata({
    locale,
    path: ROUTES.textbooks,
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: splitKeywords(tm("keywords")),
  });
}

/**
 * `params` va `searchParams` faqat `<Suspense>` ichidagi `CatalogContent` da o'qiladi (aks holda
 * App Shell bitta URL'ga bog'lanadi). Filtrlar URL'da: natijalar serverda chiqadi, `?bet=2` kabi
 * havolalar indekslanadi.
 */
export default function CatalogPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <CatalogContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CatalogContent({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const filters = parseCatalogFilters(await searchParams);
  const t = await getTranslations({ locale, namespace: "catalogPage" });
  const tn = await getTranslations({ locale, namespace: "nav" });

  return (
    <div className="max-w-site mx-auto flex w-full flex-col gap-8 px-4 pt-10 pb-20 sm:px-8 sm:pt-12 sm:pb-24">
      <SectionJsonLd locale={locale} name={t("title")} path={ROUTES.textbooks} />
      <div className="flex flex-col gap-2.5">
        <Breadcrumbs items={[{ label: tn("home"), href: ROUTES.home }, { label: t("title") }]} />
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] sm:text-[2.75rem]">
          {t("title")}
        </h1>
      </div>
      <div className="flex items-start gap-10">
        <aside aria-label={t("filters")} className="hidden w-[16.25rem] shrink-0 lg:block">
          <CatalogFilters key={catalogFiltersKey(filters)} filters={filters} />
        </aside>
        <Suspense fallback={<CatalogResultsSkeleton />}>
          <CatalogResults
            filters={filters}
            filterButton={<CatalogFilterSheet filters={filters} />}
          />
        </Suspense>
      </div>
    </div>
  );
}
