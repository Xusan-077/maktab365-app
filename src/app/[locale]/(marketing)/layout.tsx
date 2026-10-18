import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { MobileNav } from "@/components/layout/MobileNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { MAIN_CONTENT_ID } from "@/components/layout/SkipLink";
import { routing } from "@/lib/i18n/routing";

/** Ochiq (marketing) sayt: header, footer va mobil pastki menyu. Panel va kirish sahifalarida bular yo'q. */
export default async function MarketingLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <div
      data-layout="marketing"
      className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 print:pb-0"
    >
      <SiteHeader />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}
