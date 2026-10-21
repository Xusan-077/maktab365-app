import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookCreateView } from "@/components/admin/BookEditView";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/kitoblar/yangi">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.bookForm" });
  return { title: t("createTitle") };
}

export default async function AdminNewBookPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <BookCreateView />;
}
