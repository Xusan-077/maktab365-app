import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { routing } from "@/lib/i18n/routing";

/** Shaxsiy panellar (kabinet, ustoz, sozlamalar): sidebar + topbar qobig'i; marketing header/footer yo'q. */
export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <AppShell>{children}</AppShell>;
}
