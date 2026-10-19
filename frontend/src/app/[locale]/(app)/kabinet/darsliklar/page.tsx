import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogPageContent } from "@/components/catalog/CatalogPageContent";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/kabinet/darsliklar">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "catalog.meta" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function PanelCatalogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <CatalogPageContent base="kabinet" searchParams={searchParams} />;
}
