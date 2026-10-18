import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GuestProgress } from "@/lib/merge-guest-data";
import { isBookmarkEvent, type ProgressEvent } from "@/lib/progress/events";
import { reduceTopic } from "@/lib/progress/reduce";

export const GUEST_STORAGE_KEY = "maktab365-guest";

interface GuestState {
  progress: Record<string, GuestProgress>;
  /** Xatcho'p qo'yilgan mavzu id'lari. */
  bookmarks: string[];
  /** Hodisani mehmon ma'lumotiga qo'llaydi (akkauntdagi bilan bir xil qoidalar). */
  record: (event: ProgressEvent) => void;
  clear: () => void;
}

// Akkauntga kirmagan foydalanuvchining progress va xatcho'plari. Kirgandan keyin `mergeGuestData`
// akkauntga qo'shadi va store tozalanadi. skipHydration: SSR bilan mos kelishi uchun qo'lda rehydrate.
export const useGuestStore = create<GuestState>()(
  persist(
    (set) => ({
      progress: {},
      bookmarks: [],
      record: (event) =>
        set((state) => {
          if (isBookmarkEvent(event)) {
            const has = state.bookmarks.includes(event.topicId);
            if (has === event.bookmarked) return state;
            return {
              bookmarks: event.bookmarked
                ? [...state.bookmarks, event.topicId]
                : state.bookmarks.filter((id) => id !== event.topicId),
            };
          }
          const current = state.progress[event.topicId];
          const next = reduceTopic(
            current && {
              readStatus: current.readStatus ?? "none",
              exerciseStatus: current.exerciseStatus ?? "none",
              mistakes: current.mistakes,
              lastBlockId: current.lastBlockId,
              solved: current.solved,
              attempts: current.attempts,
            },
            event,
          );
          if (!next) return state;
          return {
            progress: {
              ...state.progress,
              [event.topicId]: { ...next, updatedAt: new Date().toISOString() },
            },
          };
        }),
      clear: () => set({ progress: {}, bookmarks: [] }),
    }),
    {
      name: GUEST_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ progress: state.progress, bookmarks: state.bookmarks }),
      skipHydration: true,
    },
  ),
);
