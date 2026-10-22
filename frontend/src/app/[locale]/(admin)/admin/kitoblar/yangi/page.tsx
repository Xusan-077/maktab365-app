import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PdfBookWizard } from "@/components/admin/PdfBookWizard";
import { PageHeader } from "@/components/layout/PageHeader";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/kitoblar/yangi">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.pdfWizard" });
  return { title: t("createTitle") };
}

export default async function AdminNewPdfBookPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "admin.pdfWizard" });
  return (
    <>
      <PageHeader title={t("createTitle")} description={t("createDescription")} />
      <PdfBookWizard />
    </>
  );
}
