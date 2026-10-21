import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminShell } from "@/components/admin/AdminShell";
import { StaffGate } from "@/components/admin/StaffGate";
import { GateSkeleton } from "@/components/cabinet/AccountGate";
import { routing } from "@/lib/i18n/routing";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin" });
  // Admin panel qidiruv tizimlariga kerak emas
  return {
    title: { default: t("brand"), template: `%s — ${t("brand")}` },
    robots: { index: false, follow: false },
  };
}

/**
 * Admin panel (`/admin/**`): marketing va o'quvchi/o'qituvchi panellaridan alohida qobiq.
 * Kirish faqat editor/admin: proxy sessiya bo'yicha, `StaffGate` esa backend `/me/` bo'yicha tekshiradi.
 */
export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <Suspense fallback={<GateSkeleton />}>
      <StaffGate>
        <AdminShell>{children}</AdminShell>
      </StaffGate>
    </Suspense>
  );
}
