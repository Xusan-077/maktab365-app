import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_READER_PREFS,
  nextTone,
  sanitizePrefs,
  type ReaderPrefs,
} from "@/lib/pdf/reader-prefs";

export const READER_PREFS_STORAGE_KEY = "maktab365-reader-prefs";

interface ReaderPrefsState extends ReaderPrefs {
  cycleTone: () => void;
  setTone: (tone: ReaderPrefs["tone"]) => void;
  setMode: (mode: ReaderPrefs["mode"]) => void;
}

/** O'qish oynasi sozlamalari (qurilma bo'yicha): sahifa fon rejimi va o'qish rejimi (↔ / ↕). */
export const useReaderPrefsStore = create<ReaderPrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_READER_PREFS,
      cycleTone: () => set((state) => ({ tone: nextTone(state.tone) })),
      setTone: (tone) => set({ tone }),
      setMode: (mode) => set({ mode }),
    }),
    {
      name: READER_PREFS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tone: state.tone, mode: state.mode }),
      merge: (persisted, current) => ({ ...current, ...sanitizePrefs(persisted) }),
      skipHydration: true,
    },
  ),
);
