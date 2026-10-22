import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SubjectsView } from "@/components/admin/SubjectsView";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/fanlar">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.subjects" });
  return { title: t("title") };
}

export default async function AdminSubjectsPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <SubjectsView />;
}
