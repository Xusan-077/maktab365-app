import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TopicMaterialsView } from "@/components/admin/topic/TopicMaterialsView";
import { isUuid } from "@/lib/admin/ids";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/kitoblar/[id]/mavzu/[mavzuId]">;

/** Kitob va bo'lim id'lari build vaqtida noma'lum: bitta namuna yo'l (qarang `kitoblar/[id]`). */
const SAMPLE_ID = "00000000-0000-4000-8000-000000000000";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: SAMPLE_ID, mavzuId: SAMPLE_ID }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.topic" });
  return { title: t("metaTitle") };
}

export default async function AdminTopicPage({ params }: Props) {
  const { locale, id, mavzuId } = await params;
  if (!hasLocale(routing.locales, locale) || !isUuid(id) || !isUuid(mavzuId)) notFound();
  setRequestLocale(locale);
  return <TopicMaterialsView bookId={id} topicId={mavzuId} />;
}
