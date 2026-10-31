/** Kitoblar o'qish oynasi boshqaruvlari uchun umumiy klasslar (`bk-*` tokenlari, `globals.css`). */

/** 44×44 ikonka tugma; `aria-pressed`/`aria-expanded` holatida ajratiladi. */
export const BK_ICON_BUTTON =
  "text-bk-ink hover:bg-bk-accent-soft inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors aria-pressed:bg-bk-accent-soft aria-pressed:text-bk-accent aria-expanded:bg-bk-accent-soft aria-expanded:text-bk-accent disabled:pointer-events-none disabled:opacity-40";

/** Tepa va pastki panel balandligi (px): sahifa shu masofa bilan chetlanadi, panel ustiga chiqmaydi. */
export const BAR_INSET = 64;

/** `Tooltip` matni: "Mundarija (T)". */
export function withKey(label: string, key: string): string {
  return `${label} (${key})`;
}
