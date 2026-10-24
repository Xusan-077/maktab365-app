"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePreferencesStore } from "@/stores/preferences.store";
import { cn } from "@/lib/utils/cn";
import { THEMES } from "@/lib/utils/preferences";

/**
 * system → light → dark aylanadi. Ikonka `<html data-theme-pref>` bo'yicha CSS orqali almashadi,
 * shuning uchun hydrationdan oldin ham to'g'ri ko'rinadi.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const theme = usePreferencesStore((state) => state.theme);
  const setTheme = usePreferencesStore((state) => state.setTheme);

  function cycle() {
    setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${t("toggle")}: ${t(theme)}`}
      title={t("toggle")}
      className={cn(
        "text-foreground hover:bg-subtle relative inline-flex size-10 items-center justify-center rounded-lg transition-colors",
        className,
      )}
    >
      <Monitor
        className="size-5 in-data-[theme-pref=dark]:hidden in-data-[theme-pref=light]:hidden"
        aria-hidden
      />
      <Sun className="hidden size-5 in-data-[theme-pref=light]:block" aria-hidden />
      <Moon className="hidden size-5 in-data-[theme-pref=dark]:block" aria-hidden />
    </button>
  );
}
