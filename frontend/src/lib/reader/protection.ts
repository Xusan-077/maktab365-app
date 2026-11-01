/**
 * O'qish oynasi himoyasining sof mantiqi. Bu TO'SIQ darajasi: brauzerning o'zini to'liq
 * bloklab bo'lmaydi (DevTools, skrinshot), maqsad — oddiy yuklab olish/nusxalashni qiyinlashtirish.
 */

/** Matn kiritiladigan joylar himoyadan ozod (yon daftar, qidiruv, bet raqami). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

/** Ctrl/⌘+S (saqlash), Ctrl/⌘+P (chop etish), Ctrl/⌘+Shift+S: brauzer dialogi ochilmasin. */
export function isBlockedShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey">) {
  if (!event.ctrlKey && !event.metaKey) return false;
  const key = event.key.toLowerCase();
  return key === "s" || key === "p";
}

/** `NEXT_PUBLIC_READER_WATERMARK=1` bo'lsa o'qish oynasida foydalanuvchi belgisi chiziladi. */
export const readerWatermarkEnabled = () => process.env.NEXT_PUBLIC_READER_WATERMARK === "1";

/** Suv belgisi matni: ism va email (bo'lsa), bo'sh bo'lsa — belgi yo'q. */
export function watermarkLabel(user: { name?: string | null; email?: string | null } | null) {
  const parts = [user?.name?.trim(), user?.email?.trim()].filter(Boolean);
  return parts.join(" · ");
}
