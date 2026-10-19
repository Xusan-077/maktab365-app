import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const RECENT_STORAGE_KEY = "maktab365-recent";
export const RECENT_LIMIT = 12;

export interface RecentVisit {
  topicId: string;
  /** ISO sana. */
  openedAt: string;
}

interface RecentState {
  visits: RecentVisit[];
  visit: (topicId: string) => void;
}

/** Yangi ochilgan mavzu ro'yxat boshiga chiqadi; takrorlanmaydi va `RECENT_LIMIT` dan oshmaydi. */
export function addVisit(visits: RecentVisit[], topicId: string, now: Date): RecentVisit[] {
  return [
    { topicId, openedAt: now.toISOString() },
    ...visits.filter((item) => item.topicId !== topicId),
  ].slice(0, RECENT_LIMIT);
}

// Yaqinda ochilgan mavzular (shu qurilmada). skipHydration: SSR bilan mos kelishi uchun qo'lda rehydrate.
export const useRecentStore = create<RecentState>()(
  persist(
    (set) => ({
      visits: [],
      visit: (topicId) => set((state) => ({ visits: addVisit(state.visits, topicId, new Date()) })),
    }),
    {
      name: RECENT_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ visits: state.visits }),
      skipHydration: true,
    },
  ),
);
