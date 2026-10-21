import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TopicCreateView } from "@/components/admin/TopicForm";
import { isUuid } from "@/lib/admin/ids";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/mavzular/yangi">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.topic" });
  return { title: t("createTitle") };
}

export default async function AdminNewTopicPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { book, chapter } = await searchParams;
  if (typeof book !== "string" || typeof chapter !== "string") notFound();
  if (!isUuid(book) || !isUuid(chapter)) notFound();
  return <TopicCreateView bookId={book} chapterId={chapter} />;
}
