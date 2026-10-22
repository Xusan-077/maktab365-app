import { clampPage } from "./page-nav";

/** PDF darslikda o'qish pozitsiyasi; `updatedAt` — ISO vaqt. */
export interface PdfPosition {
  page: number;
  updatedAt: string;
}

/**
 * Akkaunt va mehmon pozitsiyalaridan qaysi biri yutadi. Qoida backend bilan bir xil
 * (`contracts/fixtures/merge-pdf-progress.json`): faqat qat'iy yangiroq vaqt almashtiradi, teng
 * bo'lsa akkaunt qoladi; sahifa monoton emas (orqaga qaytish ham yangi yozuv).
 */
export function mergePdfPosition(
  account: PdfPosition | null | undefined,
  guest: PdfPosition | null | undefined,
): PdfPosition | null {
  if (!account) return guest ?? null;
  if (!guest) return account;
  return Date.parse(guest.updatedAt) > Date.parse(account.updatedAt) ? guest : account;
}

/** Ochilganda qaysi sahifadan boshlash: saqlangan pozitsiya (kitob uzunligiga tuzatilgan) yoki 1. */
export function resumePage(position: PdfPosition | null | undefined, total: number): number {
  return position ? clampPage(position.page, total) : 1;
}
