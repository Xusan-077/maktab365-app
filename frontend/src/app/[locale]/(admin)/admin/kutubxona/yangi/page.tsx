import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LibraryCreateView } from "@/components/admin/library/LibraryEditor";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/kutubxona/yangi">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.library.form" });
  return { title: t("newTitle") };
}

export default async function AdminNewLibraryBookPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <LibraryCreateView />;
}
