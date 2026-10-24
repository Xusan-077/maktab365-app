"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Select } from "@/components/ui/Select";
import { useLocaleSwitch } from "@/hooks/useLocaleSwitch";
import { locales } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const { switchTo, pending } = useLocaleSwitch();

  return (
    <div className={cn("inline-flex", className)}>
      <Select
        aria-label={t("label")}
        icon={<Globe className="size-4" />}
        value={locale}
        options={locales.map((value) => ({ value, label: t(`names.${value}`) }))}
        searchable={false}
        disabled={pending}
        onChange={switchTo}
        className="w-auto min-w-40"
      />
    </div>
  );
}
