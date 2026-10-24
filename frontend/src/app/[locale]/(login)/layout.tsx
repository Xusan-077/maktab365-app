import { Onest } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils/cn";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

/**
 * Kirish va kod kiritish: butun ekran, o'zining dizayni (header/footer yo'q). Onest shrifti faqat
 * shu guruhda yuklanadi — qolgan sayt Inter'da qoladi.
 */
export default async function LoginLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <div
      data-layout="login"
      className={cn(
        onest.variable,
        "bg-auth-bg text-auth-text min-h-dvh font-[family-name:var(--font-onest),var(--font-inter),sans-serif]",
      )}
    >
      {children}
    </div>
  );
}
