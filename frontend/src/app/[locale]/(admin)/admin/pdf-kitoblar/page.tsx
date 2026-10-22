import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PdfBooksView } from "@/components/admin/PdfBooksView";
import { Skeleton } from "@/components/ui/Skeleton";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/pdf-kitoblar">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.pdfBooks" });
  return { title: t("title") };
}

export default async function AdminPdfBooksPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    // `useSearchParams` (URL filtrlari) uchun chegara
    <Suspense fallback={<Skeleton className="h-96" />}>
      <PdfBooksView />
    </Suspense>
  );
}
