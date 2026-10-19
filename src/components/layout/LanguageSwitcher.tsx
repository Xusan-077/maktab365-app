"use client";

import { useTransition } from "react";
import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Select } from "@/components/ui/Select";
import { isLocale, LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME, locales } from "@/lib/i18n/config";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    if (!isLocale(next)) return;
    // Tanlov cookie'da saqlanadi: keyingi tashrifda `/` shu tilga yo'naltiradi
    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    startTransition(() => {
      router.replace(`${pathname}${window.location.search}`, { locale: next });
    });
  }

  return (
    <div className={cn("inline-flex", className)}>
      <Select
        aria-label={t("label")}
        icon={<Globe className="size-4" />}
        value={locale}
        options={locales.map((value) => ({ value, label: t(`names.${value}`) }))}
        searchable={false}
        disabled={pending}
        onChange={onChange}
        className="w-auto min-w-40"
      />
    </div>
  );
}
