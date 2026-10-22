import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthProvider } from "@/components/layout/AuthProvider";
import { PreferencesProvider } from "@/components/layout/PreferencesProvider";
import { QueryProvider } from "@/components/layout/QueryProvider";
import { SkipLink } from "@/components/layout/SkipLink";
import { MotionProvider } from "@/components/ui/motion";
import { Toaster } from "@/components/ui/Toast";
import { routing } from "@/lib/i18n/routing";
import { SITE_URL } from "@/lib/i18n/seo";
import { PREFERENCES_INIT_SCRIPT } from "@/lib/utils/preferences";
import { SPLASH_INIT_SCRIPT } from "@/lib/utils/splash";
import "../globals.css";
import "../splash.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

/** Brend ko'k rangi: brauzer interfeysi va PWA manifest uchun. */
export const viewport: Viewport = { themeColor: "#1D4FC6" };

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
    <html lang={locale} className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SPLASH_INIT_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground min-h-full font-sans antialiased">
        <NextIntlClientProvider locale={locale}>
          <QueryProvider>
            <AuthProvider>
              <MotionProvider>
                <PreferencesProvider />
                <SkipLink />
                {children}
                <Toaster />
              </MotionProvider>
            </AuthProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
