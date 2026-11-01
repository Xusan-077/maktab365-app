import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookTypesView } from "@/components/admin/library/BookTypesView";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/kutubxona/turlar">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.library.types" });
  return { title: t("metaTitle") };
}

export default async function AdminBookTypesPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <BookTypesView />;
}
