import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { DashboardView } from "@/components/admin/DashboardView";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin">;

/** Bosh sahifa sarlavhasi — admin layout'ining `default` i ("Boshqaruv paneli · darslik365"). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return {};
}

export default async function AdminDashboardPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <DashboardView />;
}
