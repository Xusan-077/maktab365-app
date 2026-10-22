import type { GuestPdfProgress } from "@/lib/pdf-books/api";
import type { PdfPosition } from "./progress";

export type PdfMergeOutcome = "empty" | "merged" | "failed";

export interface GuestPdfData {
  /** `{ [kitob id]: oxirgi sahifa va yozuv vaqti }`. */
  positions: Record<string, PdfPosition>;
  /** Saqlangan kitob id'lari. */
  bookmarks: string[];
}

export interface PdfMergeOptions {
  api: {
    mergeGuest(data: {
      progress?: GuestPdfProgress[];
      bookmarks?: string[];
    }): Promise<{ pdf_progress: number; pdf_bookmarks: number; failed: string[] }>;
  };
  /** Mehmon ma'lumoti (store rehydrate qilingan). */
  load: () => Promise<GuestPdfData>;
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
 * Mehmonning PDF pozitsiyalari va saqlangan kitoblarini akkauntga qo'shadi (idempotent). Xatoda
 * ma'lumot saqlanadi va keyingi kirishda yoki internet qaytganda qayta yuboriladi (chaqiruvchi
 * `merge` ni qayta ishga tushiradi).
 */
export async function mergePdfGuestData(options: PdfMergeOptions): Promise<PdfMergeOutcome> {
  const { positions, bookmarks } = await options.load();
  const items = toGuestItems(positions);
  if (items.length === 0 && bookmarks.length === 0) return "empty";
  try {
    const chunks = Math.ceil(Math.max(items.length, bookmarks.length) / PDF_MERGE_CHUNK);
    for (let index = 0; index < chunks; index += 1) {
      const start = index * PDF_MERGE_CHUNK;
      await options.api.mergeGuest({
        progress: items.slice(start, start + PDF_MERGE_CHUNK),
        bookmarks: bookmarks.slice(start, start + PDF_MERGE_CHUNK),
      });
    }
  } catch {
    return "failed";
  }
  options.onMerged();
  return "merged";
}
