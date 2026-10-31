import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LibraryEditView } from "@/components/admin/library/LibraryEditor";
import { isUuid } from "@/lib/admin/ids";
import { routing } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/admin/kutubxona/[id]">;

/** Id'lar bazada (build vaqtida noma'lum): bitta namuna yo'l prerender uchun, qolganlari so'rovda. */
const SAMPLE_ID = "00000000-0000-4000-8000-000000000000";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: SAMPLE_ID }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin.library.form" });
  return { title: t("editTitle") };
}

export default async function AdminLibraryBookPage({ params }: Props) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  if (!isUuid(id)) notFound();
  return <LibraryEditView id={id} />;
}
