import type { AppBase } from "@/lib/utils/routes";

/**
 * Yagona konteyner kengliklari: marketing `max-w-6xl`, panel `max-w-5xl`, mavzu matni ~70 belgi.
 * Panel kengligini `AppShell` beradi, shuning uchun sahifa ichida faqat marketingga qobiq kerak.
 */
export const MARKETING_CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6";
export const PANEL_CONTAINER = "mx-auto w-full max-w-5xl";
export const READING_WIDTH = "max-w-[70ch]";

/** Sahifa konteyneri: marketingda o'zining kengligi va chetlari, panelda `AppShell` `<main>`i beradi. */
export const pageShellClass = (base: AppBase) =>
  base === "marketing" ? `${MARKETING_CONTAINER} py-8` : "w-full";

/** Yagona oraliq shkalasi: sahifa bo'limlari orasi `gap-8`, bo'lim ichi `gap-4`, mayda guruhlar `gap-2`. */
export const PAGE_STACK = "flex flex-col gap-8";
