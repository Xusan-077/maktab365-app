import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FaqSection } from "@/components/home/FaqSection";
import { pageShellClass } from "@/components/layout/containers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { ROUTES } from "@/lib/utils/routes";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/yordam">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "helpPage" });
  return {
    title: t("title"),
    description: t("lead"),
    alternates: getAlternates(locale, ROUTES.help),
  };
}

function HelpContent() {
  const t = useTranslations("helpPage");
  const tb = useTranslations("breadcrumb");
  return (
    <div className={`${pageShellClass("marketing")} flex flex-col gap-6`}>
      <Breadcrumbs items={[{ label: tb("home"), href: ROUTES.home }, { label: t("title") }]} />
      <PageHeader title={t("title")} description={t("lead")} />
      <div className="flex max-w-3xl flex-col gap-6">
        <FaqSection />
        <p className="text-muted">{t("signedInHint")}</p>
      </div>
    </div>
  );
}

export default async function HelpPage({ params }: PageProps<"/[locale]/yordam">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <HelpContent />;
}
