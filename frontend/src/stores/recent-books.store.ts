import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { pushRecent, sanitizeRecent, type RecentBook } from "@/lib/pdf/recent";

export const RECENT_BOOKS_STORAGE_KEY = "maktab365-recent-books";

interface RecentBooksState {
  items: RecentBook[];
  add: (book: RecentBook) => void;
  clear: () => void;
}

/** Oxirgi ko'rilgan kitoblar (mehmon va kirgan foydalanuvchi uchun, faqat shu brauzerda). */
export const useRecentBooksStore = create<RecentBooksState>()(
  persist(
    (set) => ({
      items: [],
      add: (book) => set((state) => ({ items: pushRecent(state.items, book) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: RECENT_BOOKS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      merge: (persisted, current) => ({
        ...current,
        items: sanitizeRecent((persisted as { items?: unknown } | undefined)?.items),
      }),
      skipHydration: true,
    },
  ),
);
