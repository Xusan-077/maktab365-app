"use client";

import { useTransition, type ChangeEvent } from "react";
import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { isLocale, LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME, locales } from "@/lib/i18n/config";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (!isLocale(next)) return;
    // Tanlov cookie'da saqlanadi: keyingi tashrifda `/` shu tilga yo'naltiradi
    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    startTransition(() => {
      router.replace(`${pathname}${window.location.search}`, { locale: next });
    });
  }

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <Globe className="text-muted pointer-events-none absolute left-3 size-4" aria-hidden />
      <select
        aria-label={t("label")}
        value={locale}
        disabled={pending}
        onChange={onChange}
        className="border-border bg-surface text-foreground hover:border-primary-300 h-10 cursor-pointer appearance-none rounded-lg border pr-3 pl-9 text-sm shadow-xs transition-colors disabled:cursor-wait disabled:opacity-70"
      >
        {locales.map((value) => (
          <option key={value} value={value}>
            {t(`names.${value}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
