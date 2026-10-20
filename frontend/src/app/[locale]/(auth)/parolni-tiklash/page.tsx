import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResetPasswordView } from "@/components/auth/ResetPasswordView";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/parolni-tiklash">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "authForm" });
  // Shaxsiy sahifalar qidiruv tizimlariga kerak emas
  return { title: t("reset.title"), robots: { index: false, follow: false } };
}

export default async function ResetPasswordPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Suspense>
      <ResetPasswordView />
    </Suspense>
  );
}
