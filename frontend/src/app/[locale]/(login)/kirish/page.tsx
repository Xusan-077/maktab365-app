import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginView } from "@/components/login/LoginView";
import { routing } from "@/lib/i18n/routing";
import { getLatestBooks } from "@/lib/pdf-books/server";

type Props = PageProps<"/[locale]/kirish">;

/** Kollaj uchun so'nggi qo'shilgan kitoblar soni (desktopda 4 ta, mobilda 2 ta ko'rinadi). */
const COLLAGE_BOOKS = 4;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "login" });
  // Shaxsiy sahifalar qidiruv tizimlariga kerak emas
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // Backend javob bermasa ham kirish ishlashi kerak: kollaj shunchaki ko'rinmaydi.
  const covers = await getLatestBooks(COLLAGE_BOOKS).catch(() => []);
  return (
    <Suspense>
      <LoginView covers={covers} />
    </Suspense>
  );
}
