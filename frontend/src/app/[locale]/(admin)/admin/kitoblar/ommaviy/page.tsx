import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BulkUploadView } from "@/components/admin/BulkUploadView";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/kitoblar/ommaviy">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.bulk" });
  return { title: t("title") };
}

export default async function AdminBulkUploadPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <BulkUploadView />;
}
