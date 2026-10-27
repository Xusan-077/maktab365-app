import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GamePlayView } from "@/components/games/GamePlayView";
import { GAME_KEYS, isGameId } from "@/lib/games/config";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/games/[topicSlug]/[game]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, game } = await params;
  if (!hasLocale(routing.locales, locale) || !isGameId(game)) notFound();
  const t = await getTranslations({ locale, namespace: "games.list" });
  return { title: t(`${GAME_KEYS[game]}.name`), robots: { index: false } };
}

/** O'yin ekrani: holat `useGameStore` da (modal sozlaydi), sahifa yangilansa sessionStorage'dan. */
export default function GamePlayPage({ params }: Props) {
  return (
    <Suspense>
      <GamePlayContent params={params} />
    </Suspense>
  );
}

async function GamePlayContent({ params }: Pick<Props, "params">) {
  const { locale, topicSlug, game } = await params;
  if (!hasLocale(routing.locales, locale) || !isGameId(game)) notFound();
  setRequestLocale(locale);
  return <GamePlayView topicSlug={topicSlug} game={game} />;
}
