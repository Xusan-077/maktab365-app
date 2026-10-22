import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MARKETING_CONTAINER } from "@/components/layout/containers";
import { PdfReaderLoader } from "@/components/pdf/PdfReaderLoader";
import { isUuid } from "@/lib/admin/ids";
import { routing } from "@/lib/i18n/routing";

/**
 * Kitob id'lari build vaqtida noma'lum (bazada): bitta namuna yo'l oldindan quriladi, qolganlari
 * so'rov vaqtida (`dynamicParams`) chiqadi. Sahifa o'zi faqat mijoz komponentini chizadi.
 */
const SAMPLE_ID = "00000000-0000-4000-8000-000000000000";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: SAMPLE_ID }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/pdf-kitoblar/[id]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pdfBooks.meta" });
  // Kitob nomi mijozda yuklanadi; qidiruv tizimlariga bu sahifa kerak emas (PDF o'qish oynasi).
  return { title: t("readerTitle"), robots: { index: false, follow: true } };
}

export default async function PdfReaderPage({ params }: PageProps<"/[locale]/pdf-kitoblar/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !isUuid(id)) notFound();
  setRequestLocale(locale);
  return (
    <div className={`${MARKETING_CONTAINER} py-4`}>
      <PdfReaderLoader bookId={id} />
    </div>
  );
}
