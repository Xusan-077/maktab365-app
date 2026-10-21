import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminOnly } from "@/components/admin/AdminOnly";
import { UsersView } from "@/components/admin/UsersView";
import { Skeleton } from "@/components/ui/Skeleton";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/foydalanuvchilar">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.users" });
  return { title: t("title") };
}

export default async function AdminUsersPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <AdminOnly>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <UsersView />
      </Suspense>
    </AdminOnly>
  );
}
