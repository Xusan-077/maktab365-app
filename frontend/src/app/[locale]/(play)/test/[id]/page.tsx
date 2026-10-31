import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isUuid } from "@/lib/admin/ids";
import { PublicQuizView } from "@/components/quizzes/PublicQuizView";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/test/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "quizzes" });
  return { title: t("public.title"), robots: { index: false, follow: false } };
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
  return <PublicQuizView quizId={id} />;
}
