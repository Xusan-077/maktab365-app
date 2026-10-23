import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SubjectsGrid } from "@/components/home/SubjectsSection";
import { MARKETING_CONTAINER, PAGE_STACK } from "@/components/layout/containers";
import { PageHeader } from "@/components/layout/PageHeader";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { ROUTES } from "@/lib/utils/routes";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/fanlar">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "subjectsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: getAlternates(locale, ROUTES.subjects),
  };
}

export default async function SubjectsPage({ params }: PageProps<"/[locale]/fanlar">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "subjectsPage" });
  return (
    <div className={`${MARKETING_CONTAINER} py-8 ${PAGE_STACK}`}>
      <PageHeader title={t("title")} description={t("description")} />
      <SubjectsGrid />
    </div>
  );
}
