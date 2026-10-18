import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { SubjectPageContent } from "@/components/catalog/SubjectPageContent";
import { subjectStaticParams } from "@/lib/api/static-params";
import { routing } from "@/lib/i18n/routing";
import { subjectPanelMetadata } from "@/lib/utils/panel-metadata";

type Props = PageProps<"/[locale]/kabinet/fanlar/[subject]">;

export async function generateStaticParams() {
  return subjectStaticParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, subject } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return subjectPanelMetadata(locale, subject);
}

export default async function PanelSubjectPage({ params }: Props) {
  const { locale, subject } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <SubjectPageContent slug={subject} base="kabinet" locale={locale} />;
}
