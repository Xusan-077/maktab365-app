import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isUuid } from "@/lib/admin/ids";
import { QuizPlayView } from "@/components/quizzes/QuizPlayView";
import { routing } from "@/lib/i18n/routing";

/**
 * Test id'lari build vaqtida noma'lum (bazada): bitta namuna yo'l oldindan quriladi, qolganlari
 * so'rov vaqtida chiqadi (aks holda layout'dagi `usePathname()` prerender'ni bloklaydi).
 */
const SAMPLE_ID = "00000000-0000-4000-8000-000000000000";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: SAMPLE_ID }));
}

type Props = PageProps<"/[locale]/ustoz/testlar/[id]/oynash">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "quizzes" });
  return { title: t("play.title"), robots: { index: false, follow: false } };
}

export default function Page({ params }: Props) {
  return (
    <Suspense>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<Props, "params">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !isUuid(id)) notFound();
  setRequestLocale(locale);
  return <QuizPlayView quizId={id} />;
}
