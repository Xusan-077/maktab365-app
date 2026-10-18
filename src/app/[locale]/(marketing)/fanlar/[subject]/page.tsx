import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SubjectPageContent } from "@/components/catalog/SubjectPageContent";
import { getSubjectPageData } from "@/lib/api/server";
import { subjectStaticParams } from "@/lib/api/static-params";
import { getLocalized } from "@/lib/i18n/localized";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { subjectPath } from "@/lib/utils/routes";

export async function generateStaticParams() {
  return subjectStaticParams();
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/fanlar/[subject]">): Promise<Metadata> {
  const { locale, subject: slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const data = await getSubjectPageData(slug);
  if (!data) notFound();
  const t = await getTranslations({ locale, namespace: "subjectsPage" });
  const name = getLocalized(data.subject.name, locale);
  return {
    title: name,
    description: t("metaSubject", { subject: name }),
    alternates: getAlternates(locale, subjectPath(slug)),
  };
}

export default async function SubjectPage({ params }: PageProps<"/[locale]/fanlar/[subject]">) {
  const { locale, subject: slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <SubjectPageContent slug={slug} base="marketing" locale={locale} />;
}
