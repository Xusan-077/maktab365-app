export const SUPPORT_KINDS = ["question", "suggestion", "bug", "content_error"] as const;
export type SupportKind = (typeof SUPPORT_KINDS)[number];

export const SUPPORT_STATUSES = ["new", "in_progress", "resolved", "spam"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

/** "Yordam va aloqa" formasidan yuboriladigan murojaat. */
export type SupportInput = {
  kind: SupportKind;
  message: string;
  /** Mehmon uchun majburiy; kirgan foydalanuvchida backend akkaunt emailini oladi. */
  email?: string;
  name?: string;
  /** Mavzu identifikatori ("Xato topdingizmi?" havolasidan). */
  topic?: string;
  /** Xato topilgan sahifaning to'liq manzili. */
  pageUrl?: string;
  /** Honeypot: odam to'ldirmaydi (qarang `lib/support/request.ts`). */
  website?: string;
};

/** Foydalanuvchining o'z murojaati va uning holati. */
export type SupportMessage = {
  id: string;
  kind: SupportKind;
  message: string;
  topic: string;
  pageUrl: string;
  status: SupportStatus;
  /** ISO sana. */
  createdAt: string;
};
