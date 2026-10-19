import type { ResolvedTheme, TextSize, Theme } from "@/types/preferences";

export const PREFERENCES_STORAGE_KEY = "maktab365-prefs";
export const THEMES: readonly Theme[] = ["system", "light", "dark"];
export const TEXT_SIZES: readonly TextSize[] = ["s", "m", "l"];

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyPreferences(theme: Theme, textSize: TextSize) {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(theme);
  root.dataset.themePref = theme;
  root.dataset.textSize = textSize;
}

/**
 * <head> ichida birinchi paintdan oldin ishlaydigan inline skript (flash bo'lmasligi uchun).
 * Zustand persist saqlagan `{ state: { theme, textSize } }` ni o'qiydi.
 */
export const PREFERENCES_INIT_SCRIPT = `(function(){var s={};try{s=JSON.parse(localStorage.getItem(${JSON.stringify(
  PREFERENCES_STORAGE_KEY,
)})||"{}").state||{}}catch(e){}var p=s.theme==="light"||s.theme==="dark"?s.theme:"system";var z=s.textSize==="s"||s.textSize==="l"?s.textSize:"m";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.dataset.themePref=p;r.dataset.textSize=z;})();`;
