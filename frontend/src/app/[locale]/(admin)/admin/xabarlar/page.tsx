import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MessagesView } from "@/components/admin/MessagesView";
import { Skeleton } from "@/components/ui/Skeleton";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/xabarlar">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.messages" });
  return { title: t("title") };
}

export default async function AdminMessagesPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // Filtrlar URL'da (`useSearchParams`) — Suspense chegarasi kerak.
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <MessagesView />
    </Suspense>
  );
}
