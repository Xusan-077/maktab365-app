import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_BOOK_PREFS,
  sanitizeBookPrefs,
  stepFontSize,
  type BookReaderPrefs,
} from "@/lib/books/reader";

export const BOOK_READER_STORAGE_KEY = "maktab365-book-reader";

interface BookReaderState extends BookReaderPrefs {
  setView: (view: BookReaderPrefs["view"]) => void;
  setTheme: (theme: BookReaderPrefs["theme"]) => void;
  setFont: (font: BookReaderPrefs["font"]) => void;
  setLineHeight: (lineHeight: BookReaderPrefs["lineHeight"]) => void;
  stepFont: (direction: 1 | -1) => void;
}

/** Kitob o'qish oynasi ko'rinishi (qurilma bo'yicha, localStorage): rejim, fon, shrift, hajm, qator oralig'i. */
export const useBookReaderStore = create<BookReaderState>()(
  persist(
    (set) => ({
      ...DEFAULT_BOOK_PREFS,
      setView: (view) => set({ view }),
      setTheme: (theme) => set({ theme }),
      setFont: (font) => set({ font }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      stepFont: (direction) =>
        set((state) => ({ fontSize: stepFontSize(state.fontSize, direction) })),
    }),
    {
      name: BOOK_READER_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        view: state.view,
        theme: state.theme,
        font: state.font,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitizeBookPrefs(persisted) }),
      skipHydration: true,
    },
  ),
);
