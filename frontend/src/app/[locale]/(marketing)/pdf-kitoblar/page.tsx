import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MARKETING_CONTAINER, PAGE_STACK } from "@/components/layout/containers";
import { PageHeader } from "@/components/layout/PageHeader";
import { PdfCatalogView } from "@/components/pdf/PdfCatalogView";
import { Skeleton } from "@/components/ui/Skeleton";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { ROUTES } from "@/lib/utils/routes";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/pdf-kitoblar">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pdfBooks.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: getAlternates(locale, ROUTES.pdfBooks),
  };
}

export default async function PdfBooksPage({ params }: PageProps<"/[locale]/pdf-kitoblar">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pdfBooks.catalog" });
  return (
    <div className={`${MARKETING_CONTAINER} py-8 ${PAGE_STACK}`}>
      <PageHeader title={t("title")} description={t("description")} />
      {/* `useSearchParams` (URL filtrlari) uchun chegara */}
      <Suspense fallback={<Skeleton className="h-96" />}>
        <PdfCatalogView />
      </Suspense>
    </div>
  );
}
