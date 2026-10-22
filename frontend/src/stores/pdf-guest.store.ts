import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PdfPosition } from "@/lib/pdf/progress";

export const PDF_GUEST_STORAGE_KEY = "maktab365-guest-pdf";

interface PdfGuestState {
  /** `{ [pdfBookId]: oxirgi sahifa va yozuv vaqti }` — faqat akkauntga kirmagan foydalanuvchi uchun. */
  positions: Record<string, PdfPosition>;
  record: (bookId: string, page: number, now?: Date) => void;
  clear: () => void;
}

// Mehmonning PDF o'qish pozitsiyasi. Kirgandan keyin mavjud `merge-guest-data/` orqali akkauntga
// qo'shiladi va tozalanadi. skipHydration: SSR bilan mos kelishi uchun qo'lda rehydrate.
export const usePdfGuestStore = create<PdfGuestState>()(
  persist(
    (set) => ({
      positions: {},
      record: (bookId, page, now = new Date()) =>
        set((state) => ({
          positions: { ...state.positions, [bookId]: { page, updatedAt: now.toISOString() } },
        })),
      clear: () => set({ positions: {} }),
    }),
    {
      name: PDF_GUEST_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ positions: state.positions }),
      skipHydration: true,
    },
  ),
);
