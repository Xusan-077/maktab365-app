import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { BookPageContent } from "@/components/catalog/BookPageContent";
import { bookStaticParams } from "@/lib/api/static-params";
import { routing } from "@/lib/i18n/routing";
import { bookPanelMetadata } from "@/lib/utils/panel-metadata";

type Props = PageProps<"/[locale]/ustoz/darsliklar/[bookId]">;

export async function generateStaticParams() {
  return bookStaticParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, bookId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return bookPanelMetadata(locale, bookId);
}

export default async function PanelBookPage({ params }: Props) {
  const { locale, bookId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <BookPageContent bookId={bookId} base="ustoz" locale={locale} />;
}
