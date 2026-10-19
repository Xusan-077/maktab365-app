import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TeacherView } from "@/components/teacher/TeacherView";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/ustoz">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "teacher" });
  // Shaxsiy sahifalar qidiruv tizimlariga kerak emas
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function TeacherPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <TeacherView />;
}
