import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TopicPageContent } from "@/components/topic/TopicPageContent";
import { getTopicPageData } from "@/lib/api/server";
import { topicStaticParams } from "@/lib/api/static-params";
import { getLocalized } from "@/lib/i18n/localized";
import { routing } from "@/lib/i18n/routing";
import { getAlternates, OG_IMAGES } from "@/lib/i18n/seo";
import { topicPath } from "@/lib/utils/routes";

type TopicPageProps = PageProps<"/[locale]/darsliklar/[bookId]/[topicId]">;

export async function generateStaticParams() {
  return topicStaticParams();
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { locale, bookId, topicId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const data = await getTopicPageData(bookId, topicId);
  if (!data) notFound();
  const t = await getTranslations({ locale, namespace: "topic.meta" });
  const title = getLocalized(data.topic.title, locale);
  const description = t("description", {
    book: getLocalized(data.book.title, locale),
    chapter: getLocalized(data.chapter.title, locale),
    title,
  });
  return {
    title,
    description,
    alternates: getAlternates(locale, topicPath(bookId, topicId)),
    openGraph: { title, description, type: "article", images: OG_IMAGES },
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { locale, bookId, topicId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <TopicPageContent bookId={bookId} topicId={topicId} base="marketing" locale={locale} />;
}
