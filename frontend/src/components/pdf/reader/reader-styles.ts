/** O'qish oynasi boshqaruvlari uchun umumiy klasslar (dizayn tizimi `ds-*` tokenlari). */

/** 44×44 ikonka tugma; `aria-pressed`/`aria-expanded` holatida ajratiladi. */
export const READER_ICON_BUTTON =
  "text-ds-ink hover:bg-ds-canvas inline-flex size-11 shrink-0 items-center justify-center rounded-ds-sm transition-colors aria-pressed:bg-ds-accent-tint aria-pressed:text-ds-accent-ink aria-expanded:bg-ds-accent-tint aria-expanded:text-ds-accent-ink disabled:pointer-events-none disabled:opacity-40";

/** Matnli ikkinchi darajali tugma (suzuvchi panel: Mashqlar, Test). */
export const READER_PILL_BUTTON =
  "border-ds-line text-ds-ink hover:bg-ds-canvas inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-ds-sm border px-3 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40";
