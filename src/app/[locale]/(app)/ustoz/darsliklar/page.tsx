import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/utils/routes";

/** Ustoz panelida katalog va fan filtri panelning bosh sahifasida (/ustoz). */
export default async function TeacherRedirectPage({
  params,
}: PageProps<"/[locale]/ustoz/darsliklar">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  redirect({ href: ROUTES.teacher, locale });
}
