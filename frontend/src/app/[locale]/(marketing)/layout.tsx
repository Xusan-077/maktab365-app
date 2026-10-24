import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { MAIN_CONTENT_ID } from "@/components/layout/SkipLink";
import { MarketingFooter } from "@/components/site/MarketingFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { routing } from "@/lib/i18n/routing";

/** Ochiq (marketing) sayt: header va footer. Panel va kirish sahifalarida bular yo'q. */
export default async function MarketingLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <div data-layout="marketing" className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
