import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { MAIN_CONTENT_ID } from "@/components/layout/SkipLink";
import { routing } from "@/lib/i18n/routing";

/** O'yin ekranlari: butun ekran (proyektor), sayt header/footer'i yo'q — o'zining `GameShell` i. */
export default async function PlayLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} data-layout="play" className="focus:outline-none">
      {children}
    </main>
  );
}
