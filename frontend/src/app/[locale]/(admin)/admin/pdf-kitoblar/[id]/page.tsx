import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PdfBookEditView } from "@/components/admin/PdfBookEditView";
import { isUuid } from "@/lib/admin/ids";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/pdf-kitoblar/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.pdfEdit" });
  return { title: t("editTitle") };
}

export default async function AdminPdfBookPage({ params }: Props) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !isUuid(id)) notFound();
  setRequestLocale(locale);
  return <PdfBookEditView id={id} />;
}
