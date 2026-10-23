import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MARKETING_CONTAINER, PAGE_STACK } from "@/components/layout/containers";
import { PageHeader } from "@/components/layout/PageHeader";
import { OfflineManager } from "@/components/pdf/OfflineManager";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/oflayn">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "offline" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: getAlternates(locale, "/oflayn"),
    robots: { index: false, follow: true },
  };
}

export default async function OfflinePage({ params }: PageProps<"/[locale]/oflayn">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "offline" });
  return (
    <div className={`${MARKETING_CONTAINER} py-8 ${PAGE_STACK}`}>
      <PageHeader title={t("title")} description={t("description")} />
      <OfflineManager />
    </div>
  );
}
