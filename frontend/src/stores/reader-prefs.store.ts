import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_READER_PREFS,
  nextTone,
  sanitizePrefs,
  type ReaderPrefs,
} from "@/lib/pdf/reader-prefs";
import { commitZoom } from "@/lib/pdf/zoom";

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
 * masshtab asosi, zoom (kitob ostidagi guruh, Aa menyusi, klaviatura — bitta holat; saqlanishi —
 * kitob bo'yicha, `zoom-memory.ts`) va iliq rang.
 */
export const useReaderPrefsStore = create<ReaderPrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_READER_PREFS,
      cycleTone: () => set((state) => ({ tone: nextTone(state.tone) })),
      setTone: (tone) => set({ tone }),
      setMode: (mode) => set({ mode }),
      setFit: (fit) => set({ fit }),
      // 0.01 qadam: pinch/g'ildirak qo'yib yuborilganda ko'rinish yaxlitlash tufayli sakramaydi.
      setZoom: (zoom) => set({ zoom: commitZoom(zoom) }),
      setWarm: (warm) => set({ warm }),
    }),
    {
      name: READER_PREFS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tone: state.tone,
        mode: state.mode,
        fit: state.fit,
        // Zoom bu yerda emas: har kitob uchun alohida (`lib/pdf/zoom-memory.ts`).
        warm: state.warm,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitizePrefs(persisted) }),
      skipHydration: true,
    },
  ),
);
