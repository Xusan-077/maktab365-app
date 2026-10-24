import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SiteShowcase } from "@/components/dev/SiteShowcase";

/** Redesign komponentlari namunasi: marketing qobig'idan tashqarida (o'z header/footer'i bilan). */
export default async function DevSitePage({ params }: PageProps<"/[locale]/dev/site">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  return <SiteShowcase />;
}
