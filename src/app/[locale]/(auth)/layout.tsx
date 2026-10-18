import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Logo } from "@/components/layout/Logo";
import { MAIN_CONTENT_ID } from "@/components/layout/SkipLink";
import { routing } from "@/lib/i18n/routing";

/** Kirish va onboarding: header/footer yo'q, faqat markazda logo va forma. */
export default async function AuthLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <div data-layout="auth" className="flex min-h-dvh flex-col items-center gap-2 px-4 py-10">
      <Logo height={36} />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="w-full max-w-xl focus:outline-none">
        {children}
      </main>
    </div>
  );
}
