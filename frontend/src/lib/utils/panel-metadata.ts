import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBookMeta, getSubjectMeta, getTopicMeta } from "@/lib/api/server";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";

/** Panel sahifalari shaxsiy: qidiruv tizimlariga kerak emas, shuning uchun faqat sarlavha va noindex. */
const PRIVATE = { robots: { index: false, follow: false } } as const;

export async function bookPanelMetadata(locale: Locale, bookId: string): Promise<Metadata> {
  const data = await getBookMeta(bookId);
  if (data === null) notFound();
  if (!data) return PRIVATE;
  return { title: getLocalized(data.book.title, locale), ...PRIVATE };
}

export async function subjectPanelMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const data = await getSubjectMeta(slug);
  if (data === null) notFound();
  if (!data) return PRIVATE;
  return { title: getLocalized(data.subject.name, locale), ...PRIVATE };
}

export async function topicPanelMetadata(
  locale: Locale,
  bookId: string,
  topicId: string,
): Promise<Metadata> {
  const data = await getTopicMeta(bookId, topicId);
  if (data === null) notFound();
  if (!data) return PRIVATE;
  return { title: getLocalized(data.topic.title, locale), ...PRIVATE };
}
