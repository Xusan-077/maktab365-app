import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/site/LegalPage";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { ROUTES } from "@/lib/utils/routes";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/maxfiylik">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: getAlternates(locale, ROUTES.privacy),
    // Matn yozilguncha indekslanmaydi; tayyor bo'lgach `robots` ni olib tashlang va sitemap'ga qo'shing.
    robots: { index: false, follow: true },
  };
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/maxfiylik">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <LegalPage kind="privacy" />;
}
