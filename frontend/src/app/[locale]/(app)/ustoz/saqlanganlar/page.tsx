import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TeacherSavedView } from "@/components/teacher/TeacherSavedView";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/ustoz/saqlanganlar">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "teacher.nav" });
  return { title: t("saved"), robots: { index: false, follow: false } };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <TeacherSavedView />;
}
