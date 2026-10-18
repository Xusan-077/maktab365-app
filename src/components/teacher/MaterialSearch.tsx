"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

export interface MaterialSearchProps {
  value: string;
  onChange: (value: string) => void;
}

/** Katta qidiruv maydoni: kitob yoki mavzu nomi. Enter sahifani qayta yuklamaydi. */
export function MaterialSearch({ value, onChange }: MaterialSearchProps) {
  const t = useTranslations("teacher.search");
  return (
    <form role="search" onSubmit={(event) => event.preventDefault()} className="relative">
      <Search
        className="text-muted pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={t("label")}
        placeholder={t("placeholder")}
        autoComplete="off"
        className="border-border bg-surface placeholder:text-muted hover:border-primary-300 h-14 w-full rounded-xl border pr-4 pl-12 text-lg shadow-xs transition-colors"
      />
    </form>
  );
}
