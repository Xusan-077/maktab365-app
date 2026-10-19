import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookPageContent } from "@/components/catalog/BookPageContent";
import { getBookPageData } from "@/lib/api/server";
import { bookStaticParams } from "@/lib/api/static-params";
import { getLocalized } from "@/lib/i18n/localized";
import { routing } from "@/lib/i18n/routing";
import { getAlternates, OG_IMAGES } from "@/lib/i18n/seo";
import { bookPath } from "@/lib/utils/routes";

export async function generateStaticParams() {
  return bookStaticParams();
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/darsliklar/[bookId]">): Promise<Metadata> {
  const { locale, bookId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const data = await getBookPageData(bookId);
  if (!data) notFound();
  const { book, subject } = data;
  const t = await getTranslations({ locale, namespace: "book.meta" });
  const title = getLocalized(book.title, locale);
  const description = t("description", {
    grade: book.grade,
    subject: getLocalized(subject.name, locale),
    author: getLocalized(book.author, locale),
    year: book.publishedYear,
    edition: getLocalized(book.edition, locale),
  });
  return {
    title,
    description,
    alternates: getAlternates(locale, bookPath(book.id)),
    openGraph: { title, description, type: "book", images: OG_IMAGES },
  };
}

export default async function BookPage({ params }: PageProps<"/[locale]/darsliklar/[bookId]">) {
  const { locale, bookId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <BookPageContent bookId={bookId} base="marketing" locale={locale} />;
}
