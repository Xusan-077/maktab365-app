"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { usePreferencesStore } from "@/stores/preferences.store";
import { cn } from "@/lib/utils/cn";

/** Yorug' ↔ qorong'i rejim (tizim rejimidan ham: hozirgi ko'rinishning teskarisiga o'tadi). */
export function DarkModeButton({ className }: { className?: string }) {
  const t = useTranslations("login");
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const toggle = () =>
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("themeToggle")}
      title={t("themeToggle")}
      className={cn(
        "border-auth-border text-auth-text hover:bg-auth-surface-2 focus-visible:ring-brand-ring relative inline-flex size-11 items-center justify-center rounded-xl border outline-none focus-visible:ring-4",
        className,
      )}
    >
      <Moon className="size-5 in-data-[theme=dark]:hidden" aria-hidden />
      <Sun className="hidden size-5 in-data-[theme=dark]:block" aria-hidden />
    </button>
  );
}

/** Til tanlash va qorong'i rejim tugmasi. */
export function PreferencesBar({ className }: { className?: string }) {
  const t = useTranslations("login");
  return (
    <div
      role="group"
      aria-label={t("settingsLabel")}
      className={cn("flex items-center gap-3", className)}
    >
      <LanguageSwitcher />
      <DarkModeButton />
    </div>
  );
}
