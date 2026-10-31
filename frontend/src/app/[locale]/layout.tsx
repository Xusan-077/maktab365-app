import type { Metadata, Viewport } from "next";
import { Inter, Manrope, Onest, Plus_Jakarta_Sans, Source_Serif_4 } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthModal } from "@/components/auth/AuthModal";
import { AuthProvider } from "@/components/layout/AuthProvider";
import { PreferencesProvider } from "@/components/layout/PreferencesProvider";
import { QueryProvider } from "@/components/layout/QueryProvider";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";
import { SkipLink } from "@/components/layout/SkipLink";
import { MotionProvider } from "@/components/ui/motion";
import { Toaster } from "@/components/ui/Toast";
import { routing } from "@/lib/i18n/routing";
import { SITE_URL } from "@/lib/i18n/seo";
import { PREFERENCES_INIT_SCRIPT } from "@/lib/utils/preferences";
import "../globals.css";

/** Asosiy shrift (redesign): lotin + kirill, 400–800. Inter faqat zaxira (latin-ext/cyrillic-ext). */
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

/**
 * Dizayn tizimi shriftlari (`font-ui`, `font-book` — `globals.css`): o'qish oynasi, taqdimot va admin
 * mavzu muharriri. Faqat shu sahifalarda kerak — oldindan yuklanmaydi (`preload: false`).
 */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
  preload: false,
});

/** Faqat kitob sarlavhasi uchun. */
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700"],
  display: "swap",
  preload: false,
});

/** Interaktiv o'yinlar (`font-game`): faqat lotin — kirill matni Onest'ga tushadi. */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  preload: false,
});

/**
 * Brend ko'k rangi: brauzer interfeysi va PWA manifest uchun. `viewportFit: "cover"` — iOS'da
 * `env(safe-area-inset-*)` qiymat oladi (pastki panellar "home indicator" ustida turadi).
 */
export const viewport: Viewport = { themeColor: "#1554D1", viewportFit: "cover" };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "meta" });
  const brand = await getTranslations({ locale, namespace: "brand" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: `%s — ${brand("name")}` },
    description: t("description"),
    manifest: "/manifest.webmanifest",
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${onest.variable} ${inter.variable} ${manrope.variable} ${sourceSerif.variable} ${jakarta.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_INIT_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground min-h-full font-sans antialiased">
        <NextIntlClientProvider locale={locale}>
          <QueryProvider>
            <AuthProvider>
              <MotionProvider>
                <PreferencesProvider />
                <SkipLink />
                <ServiceWorkerRegister />
                {children}
                <Toaster />
                <AuthModal />
              </MotionProvider>
            </AuthProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
