import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LibraryHome } from "@/components/cabinet/LibraryHome";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/kabinet">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "cabinet" });
  // Shaxsiy sahifalar qidiruv tizimlariga kerak emas
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CabinetPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <LibraryHome base="kabinet" />;
}
