import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GameResultView } from "@/components/games/GameResultView";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/games/[topicSlug]/natija">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "games.result" });
  return { title: t("title"), robots: { index: false } };
}

/** O'yin natijasi (holat `useGameStore` da). */
export default function GameResultPage({ params }: Props) {
  return (
    <Suspense>
      <GameResultContent params={params} />
    </Suspense>
  );
}

async function GameResultContent({ params }: Pick<Props, "params">) {
  const { locale, topicSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <GameResultView topicSlug={topicSlug} />;
}
