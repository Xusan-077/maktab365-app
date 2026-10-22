import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PdfPosition } from "@/lib/pdf/progress";

export const PDF_GUEST_STORAGE_KEY = "maktab365-guest-pdf";

interface PdfGuestState {
  /** `{ [pdfBookId]: oxirgi sahifa va yozuv vaqti }` — faqat akkauntga kirmagan foydalanuvchi uchun. */
  positions: Record<string, PdfPosition>;
  /** Saqlangan kitob id'lari (mehmon). */
  bookmarks: string[];
  record: (bookId: string, page: number, now?: Date) => void;
  setBookmark: (bookId: string, saved: boolean) => void;
  clear: () => void;
}

// Mehmonning PDF o'qish pozitsiyasi va saqlangan kitoblari. Kirgandan keyin mavjud
// `merge-guest-data/` orqali akkauntga qo'shiladi va tozalanadi. skipHydration: SSR bilan mos
// kelishi uchun qo'lda rehydrate.
export const usePdfGuestStore = create<PdfGuestState>()(
  persist(
    (set) => ({
      positions: {},
      bookmarks: [],
      record: (bookId, page, now = new Date()) =>
        set((state) => ({
          positions: { ...state.positions, [bookId]: { page, updatedAt: now.toISOString() } },
        })),
      setBookmark: (bookId, saved) =>
        set((state) => {
          const rest = state.bookmarks.filter((id) => id !== bookId);
          return { bookmarks: saved ? [...rest, bookId] : rest };
        }),
      clear: () => set({ positions: {}, bookmarks: [] }),
    }),
    {
      name: PDF_GUEST_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ positions: state.positions, bookmarks: state.bookmarks }),
      skipHydration: true,
    },
  ),
);
