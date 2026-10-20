import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ForgotPasswordView } from "@/components/auth/ForgotPasswordView";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/parolni-unutdim">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "authForm" });
  // Shaxsiy sahifalar qidiruv tizimlariga kerak emas
  return { title: t("forgot.title"), robots: { index: false, follow: false } };
}

export default async function ForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense>
      <ForgotPasswordView />
    </Suspense>
  );
}
