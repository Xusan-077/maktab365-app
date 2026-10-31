import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const BOOK_GUEST_STORAGE_KEY = "maktab365-book-guest";

/** Mehmon (kirmagan) o'quvchi: kitobdagi oxirgi bet va xatcho'plar brauzerda saqlanadi. */
interface BookGuestState {
  positions: Record<string, number>;
  bookmarks: Record<string, number[]>;
  setPosition: (bookId: string, page: number) => void;
  toggleBookmark: (bookId: string, page: number) => void;
}

export const useBookGuestStore = create<BookGuestState>()(
  persist(
    (set) => ({
      positions: {},
      bookmarks: {},
      setPosition: (bookId, page) =>
        set((state) => ({ positions: { ...state.positions, [bookId]: page } })),
      toggleBookmark: (bookId, page) =>
        set((state) => {
          const current = state.bookmarks[bookId] ?? [];
          const next = current.includes(page)
            ? current.filter((value) => value !== page)
            : [...current, page].sort((a, b) => a - b);
          return { bookmarks: { ...state.bookmarks, [bookId]: next } };
        }),
    }),
    {
      name: BOOK_GUEST_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
