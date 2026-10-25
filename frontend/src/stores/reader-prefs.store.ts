import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_READER_PREFS,
  nextTone,
  sanitizePrefs,
  type ReaderPrefs,
} from "@/lib/pdf/reader-prefs";
import { clampZoom } from "@/lib/pdf/zoom";

export const READER_PREFS_STORAGE_KEY = "maktab365-reader-prefs";

interface ReaderPrefsState extends ReaderPrefs {
  cycleTone: () => void;
  setTone: (tone: ReaderPrefs["tone"]) => void;
  setMode: (mode: ReaderPrefs["mode"]) => void;
  setFit: (fit: ReaderPrefs["fit"]) => void;
  setZoom: (zoom: number) => void;
  setWarm: (warm: boolean) => void;
}

/**
 * O'qish oynasi sozlamalari (qurilma bo'yicha, localStorage): fon, o'qish rejimi (kitob / uzluksiz),
 * masshtab asosi, zoom (kitob ostidagi guruh, Aa menyusi, klaviatura — bitta holat) va iliq rang.
 */
export const useReaderPrefsStore = create<ReaderPrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_READER_PREFS,
      cycleTone: () => set((state) => ({ tone: nextTone(state.tone) })),
      setTone: (tone) => set({ tone }),
      setMode: (mode) => set({ mode }),
      setFit: (fit) => set({ fit }),
      setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
      setWarm: (warm) => set({ warm }),
    }),
    {
      name: READER_PREFS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tone: state.tone,
        mode: state.mode,
        fit: state.fit,
        zoom: state.zoom,
        warm: state.warm,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitizePrefs(persisted) }),
      skipHydration: true,
    },
  ),
);
