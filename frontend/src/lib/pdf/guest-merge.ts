import type { GuestPdfProgress } from "@/lib/pdf-books/api";
import type { PdfPosition } from "./progress";

export type PdfMergeOutcome = "empty" | "merged" | "failed";

export interface PdfMergeOptions {
  api: {
    mergeGuest(items: GuestPdfProgress[]): Promise<{ pdf_progress: number; failed: string[] }>;
  };
  /** Mehmon pozitsiyalari (store rehydrate qilingan). */
  load: () => Promise<Record<string, PdfPosition>>;
  /** Server qabul qildi: store tozalanadi, keshlar yangilanadi. */
  onMerged: () => void;
}

/** Server har ro'yxat uchun shuncha elementni qabul qiladi. */
export const PDF_MERGE_CHUNK = 500;

export function toGuestItems(positions: Record<string, PdfPosition>): GuestPdfProgress[] {
  return Object.entries(positions).map(([id, position]) => ({
    pdf_book_id: id,
    last_page: position.page,
    updated_at: position.updatedAt,
  }));
}

/**
 * Mehmonning PDF pozitsiyalarini akkauntga qo'shadi (idempotent). Xatoda ma'lumot saqlanadi va
 * keyingi kirishda yoki internet qaytganda qayta yuboriladi (chaqiruvchi `merge` ni qayta ishga tushiradi).
 */
export async function mergePdfGuestData(options: PdfMergeOptions): Promise<PdfMergeOutcome> {
  const items = toGuestItems(await options.load());
  if (items.length === 0) return "empty";
  try {
    for (let start = 0; start < items.length; start += PDF_MERGE_CHUNK) {
      await options.api.mergeGuest(items.slice(start, start + PDF_MERGE_CHUNK));
    }
  } catch {
    return "failed";
  }
  options.onMerged();
  return "merged";
}
