import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils/cn";

/**
 * Kirish va kod kiritish: butun ekran, o'zining dizayni (header/footer yo'q).
 */
export default async function LoginLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <div data-layout="login" className={cn("bg-auth-bg text-auth-text min-h-dvh font-sans")}>
      {children}
    </div>
  );
}
