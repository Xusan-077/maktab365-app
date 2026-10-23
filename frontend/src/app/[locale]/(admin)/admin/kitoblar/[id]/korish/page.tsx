import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminBookPreview } from "@/components/admin/AdminBookPreview";
import { isUuid } from "@/lib/admin/ids";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/kitoblar/[id]/korish">;

/** Namuna yo'l (id'lar bazada): qolganlari so'rov vaqtida quriladi. */
const SAMPLE_ID = "00000000-0000-4000-8000-000000000000";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: SAMPLE_ID }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.pdfEdit" });
  return { title: t("preview"), robots: { index: false } };
}

export default async function AdminPdfPreviewPage({ params }: Props) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !isUuid(id)) notFound();
  setRequestLocale(locale);
  return <AdminBookPreview id={id} />;
}
