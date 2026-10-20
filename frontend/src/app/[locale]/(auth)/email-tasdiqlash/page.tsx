import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { VerifyEmailView } from "@/components/auth/VerifyEmailView";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/email-tasdiqlash">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "authForm" });
  // Shaxsiy sahifalar qidiruv tizimlariga kerak emas
  return { title: t("verify.title"), robots: { index: false, follow: false } };
}

export default async function VerifyEmailPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense>
      <VerifyEmailView />
    </Suspense>
  );
}
