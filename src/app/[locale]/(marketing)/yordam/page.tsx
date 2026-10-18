import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FaqSection } from "@/components/home/FaqSection";
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: tb("home"), href: ROUTES.home }, { label: t("title") }]} />
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted text-lg">{t("lead")}</p>
      </header>
      <FaqSection />
      <p className="text-muted">{t("signedInHint")}</p>
    </div>
  );
}

export default async function HelpPage({ params }: PageProps<"/[locale]/yordam">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <HelpContent />;
}
