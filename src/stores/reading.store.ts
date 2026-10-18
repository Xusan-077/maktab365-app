import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const READING_STORAGE_KEY = "maktab365-reading";

export interface ReadingPosition {
  /** 0–1: sahifaning qancha qismi aylantirilgan. */
  scroll: number;
  lastBlockId?: string;
  /** ISO sana. */
  updatedAt: string;
}

interface ReadingState {
  positions: Record<string, ReadingPosition>;
  savePosition: (topicId: string, position: Omit<ReadingPosition, "updatedAt">) => void;
}

// Keyin serverga sync qilinadi (saveProgress.lastBlockId). skipHydration: SSR bilan mos kelishi uchun
// store tracker ichida qo'lda rehydrate qilinadi.
export const useReadingStore = create<ReadingState>()(
  persist(
    (set) => ({
      positions: {},
      savePosition: (topicId, position) =>
        set((state) => ({
          positions: {
            ...state.positions,
            [topicId]: { ...position, updatedAt: new Date().toISOString() },
          },
        })),
    }),
    {
      name: READING_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ positions: state.positions }),
      skipHydration: true,
    },
  ),
);
