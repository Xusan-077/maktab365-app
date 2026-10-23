import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_READER_PREFS,
  nextFit,
  nextTone,
  sanitizePrefs,
  type ReaderPrefs,
} from "@/lib/pdf/reader-prefs";

export const READER_PREFS_STORAGE_KEY = "maktab365-reader-prefs";

interface ReaderPrefsState extends ReaderPrefs {
  cycleTone: () => void;
  toggleFit: () => void;
  setTone: (tone: ReaderPrefs["tone"]) => void;
}

/** O'qish oynasi sozlamalari (qurilma bo'yicha): sahifa fon rejimi va moslash. */
export const useReaderPrefsStore = create<ReaderPrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_READER_PREFS,
      cycleTone: () => set((state) => ({ tone: nextTone(state.tone) })),
      toggleFit: () => set((state) => ({ fit: nextFit(state.fit) })),
      setTone: (tone) => set({ tone }),
    }),
    {
      name: READER_PREFS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tone: state.tone, fit: state.fit }),
      merge: (persisted, current) => ({ ...current, ...sanitizePrefs(persisted) }),
      skipHydration: true,
    },
  ),
);
