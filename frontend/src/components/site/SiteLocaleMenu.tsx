"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useLocaleSwitch } from "@/hooks/useLocaleSwitch";
import { locales, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";

/**
 * Til tanlash. `menu` — "UZ" tugmasi va ochiladigan ro'yxat (sarlavha); `inline` — barcha tillar
 * qatorda (mobil sheet ichida).
 */
export function SiteLocaleMenu({
  variant = "menu",
  className,
}: {
  variant?: "menu" | "inline";
  className?: string;
}) {
  const t = useTranslations("language");
  const ts = useTranslations("site.localeShort");
  const locale = useLocale() as Locale;
  const { switchTo, pending } = useLocaleSwitch();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (variant === "inline") {
    return (
      <div role="group" aria-label={t("label")} className={cn("flex flex-wrap gap-2", className)}>
        {locales.map((value) => (
          <button
            key={value}
            type="button"
            lang={value}
            aria-pressed={value === locale}
            disabled={pending}
            onClick={() => switchTo(value)}
            className={cn(
              "inline-flex h-11 items-center rounded-full border px-4 text-sm transition-colors",
              value === locale
                ? "border-brand bg-brand-soft text-brand-text font-semibold"
                : "border-input-border bg-surface text-foreground font-medium",
            )}
          >
            {t(`names.${value}`)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={t("label")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
        className="border-border bg-surface text-foreground hover:bg-surface-2 flex h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors"
      >
        <Globe className="size-4" aria-hidden />
        {ts(locale)}
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("label")}
          className="border-border bg-surface absolute top-full right-0 z-50 mt-2 w-48 rounded-xl border p-1.5 shadow-lg"
        >
          {locales.map((value) => (
            <li key={value} role="option" aria-selected={value === locale}>
              <button
                type="button"
                lang={value}
                onClick={() => {
                  setOpen(false);
                  switchTo(value);
                }}
                className={cn(
                  "hover:bg-surface-2 flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm",
                  value === locale ? "text-brand-text font-semibold" : "font-medium",
                )}
              >
                {t(`names.${value}`)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
