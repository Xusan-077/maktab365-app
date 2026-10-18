import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginView } from "@/components/cabinet/LoginView";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/kirish">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "auth" });
  // Shaxsiy sahifalar qidiruv tizimlariga kerak emas
  return { title: t("loginTitle"), robots: { index: false, follow: false } };
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
