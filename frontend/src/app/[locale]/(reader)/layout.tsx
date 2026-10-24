import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { MAIN_CONTENT_ID } from "@/components/layout/SkipLink";
import { routing } from "@/lib/i18n/routing";

/** O'qish oynasi: butun ekran, o'zining boshqaruv paneli (sayt header/footer'i yo'q). */
export default async function ReaderLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} data-layout="reader" className="focus:outline-none">
      {children}
    </main>
  );
}
