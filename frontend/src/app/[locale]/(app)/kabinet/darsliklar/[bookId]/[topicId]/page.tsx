import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { TopicPageContent } from "@/components/topic/TopicPageContent";
import { topicStaticParams } from "@/lib/api/static-params";
import { routing } from "@/lib/i18n/routing";
import { topicPanelMetadata } from "@/lib/utils/panel-metadata";

type Props = PageProps<"/[locale]/kabinet/darsliklar/[bookId]/[topicId]">;

export async function generateStaticParams() {
  return topicStaticParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, bookId, topicId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return topicPanelMetadata(locale, bookId, topicId);
}

export default async function PanelTopicPage({ params }: Props) {
  const { locale, bookId, topicId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <TopicPageContent bookId={bookId} topicId={topicId} base="kabinet" locale={locale} />;
}
