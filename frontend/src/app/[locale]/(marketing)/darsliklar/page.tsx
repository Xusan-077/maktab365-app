import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogPageContent } from "@/components/catalog/CatalogPageContent";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { ROUTES } from "@/lib/utils/routes";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/darsliklar">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "catalog.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: getAlternates(locale, ROUTES.textbooks),
  };
}

export default async function CatalogPage({
  params,
  searchParams,
}: PageProps<"/[locale]/darsliklar">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <CatalogPageContent base="marketing" searchParams={searchParams} />;
}
