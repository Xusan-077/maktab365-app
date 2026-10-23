import type { GuestAnnotation, GuestPdfProgress } from "@/lib/pdf-books/api";
import type { PdfPosition } from "./progress";

export type PdfMergeOutcome = "empty" | "merged" | "failed";

export interface GuestPdfData {
  /** `{ [kitob id]: oxirgi sahifa va yozuv vaqti }`. */
  positions: Record<string, PdfPosition>;
  /** Saqlangan kitob id'lari. */
  bookmarks: string[];
  /** Sahifa belgilari (highlight + eslatma). */
  annotations?: GuestAnnotation[];
}

export interface PdfMergeOptions {
  api: {
    mergeGuest(data: {
      progress?: GuestPdfProgress[];
      bookmarks?: string[];
      annotations?: GuestAnnotation[];
    }): Promise<{
      pdf_progress: number;
      pdf_bookmarks: number;
      pdf_annotations?: number;
      failed: string[];
    }>;
  };
  /** Mehmon ma'lumoti (store rehydrate qilingan). */
  load: () => Promise<GuestPdfData>;
  /** Server qabul qildi: store tozalanadi, keshlar yangilanadi. */
  onMerged: () => void;
}

/** Server har ro'yxat uchun shuncha elementni qabul qiladi. */
export const PDF_MERGE_CHUNK = 500;

/** Mehmon ma'lumotini qo'shish xatosidan keyin qayta urinish oralig'i: 5s, 15s, 45s … 5 daqiqagacha. */
export const MERGE_RETRY_BASE_MS = 5_000;
export const MERGE_RETRY_MAX_MS = 300_000;

/** `failures` — ketma-ket muvaffaqiyatsiz urinishlar soni (≥ 1). */
export const mergeRetryDelay = (failures: number) =>
  Math.min(MERGE_RETRY_BASE_MS * 3 ** Math.max(failures - 1, 0), MERGE_RETRY_MAX_MS);
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
  const { positions, bookmarks, annotations = [] } = await options.load();
  const items = toGuestItems(positions);
  if (items.length === 0 && bookmarks.length === 0 && annotations.length === 0) return "empty";
  try {
    const chunks = Math.ceil(
      Math.max(items.length, bookmarks.length, annotations.length) / PDF_MERGE_CHUNK,
    );
    for (let index = 0; index < chunks; index += 1) {
      const start = index * PDF_MERGE_CHUNK;
      await options.api.mergeGuest({
        progress: items.slice(start, start + PDF_MERGE_CHUNK),
        bookmarks: bookmarks.slice(start, start + PDF_MERGE_CHUNK),
        annotations: annotations.slice(start, start + PDF_MERGE_CHUNK),
      });
    }
  } catch {
    return "failed";
  }
  options.onMerged();
  return "merged";
}
