import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GamesView } from "@/components/games/GamesView";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { ROUTES } from "@/lib/utils/routes";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/games">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "games.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: getAlternates(locale, ROUTES.games),
  };
}

/** Interaktiv o'yinlar: qidiruv va filtrlar URL'da (`?q=&grade=&subject=`), natijalar mijozda. */
export default async function GamesPage({ params }: PageProps<"/[locale]/games">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense>
      <GamesView />
    </Suspense>
  );
}
