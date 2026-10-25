import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const TOPIC_NOTES_STORAGE_KEY = "maktab365-konspekt";
/** Bitta qurilmada saqlanadigan yozuvlar chegarasi (eng eskilari tushib qoladi). */
export const TOPIC_NOTES_LIMIT = 500;

export interface TopicNote {
  id: string;
  bookId: string;
  /** Mundarija bo'limi (mavzu) id'si. */
  topicId: string;
  page: number;
  text: string;
  /** UTC ISO. */
  createdAt: string;
}

interface TopicNotesState {
  notes: TopicNote[];
  add: (note: Omit<TopicNote, "id" | "createdAt">) => void;
  remove: (id: string) => void;
}

const isNote = (value: unknown): value is TopicNote => {
  const note = value as Partial<TopicNote> | null;
  return (
    typeof note?.id === "string" &&
    typeof note.bookId === "string" &&
    typeof note.topicId === "string" &&
    typeof note.text === "string" &&
    typeof note.createdAt === "string" &&
    Number.isInteger(note.page)
  );
};

/**
 * Konspekt (mavzu paneli): o'qish oynasida belgilangan matndan «Konspektga qo'shish». Hozircha faqat
 * shu qurilmada (localStorage); akkauntga sinxron emas.
 */
export const useTopicNotesStore = create<TopicNotesState>()(
  persist(
    (set) => ({
      notes: [],
      add: (note) =>
        set((state) => ({
          notes: [
            ...state.notes,
            { ...note, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
          ].slice(-TOPIC_NOTES_LIMIT),
        })),
      remove: (id) => set((state) => ({ notes: state.notes.filter((note) => note.id !== id) })),
    }),
    {
      name: TOPIC_NOTES_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ notes: state.notes }),
      merge: (persisted, current) => {
        const raw = (persisted as { notes?: unknown } | null)?.notes;
        return { ...current, notes: Array.isArray(raw) ? raw.filter(isNote) : [] };
      },
    },
  ),
);
