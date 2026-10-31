import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LibraryView } from "@/components/admin/library/LibraryView";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/kutubxona">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.library" });
  return { title: t("metaTitle") };
}

export default async function AdminLibraryPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <LibraryView />;
}
