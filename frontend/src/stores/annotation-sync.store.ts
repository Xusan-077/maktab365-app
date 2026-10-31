import { create } from "zustand";
import type { AnnotationQueueState } from "@/lib/books/annotation-queue";

export type SaveState = "idle" | "saving" | "saved" | "error" | "rejected";

interface SyncState {
  queue: AnnotationQueueState;
  /** Oxirgi muvaffaqiyatli yuborishdan keyin "Saqlandi" ko'rinib turadi. */
  savedAt: number | null;
  setQueue: (queue: AnnotationQueueState) => void;
  markSaved: () => void;
}

const EMPTY: AnnotationQueueState = { pending: 0, sending: false, failure: null, code: null };

/** Navbat holati (UI ko'rsatkichi uchun). Navbatning o'zi `lib/books/annotation-sync.ts` da. */
export const useAnnotationSyncStore = create<SyncState>()((set) => ({
  queue: EMPTY,
  savedAt: null,
  setQueue: (queue) => set({ queue }),
  markSaved: () => set({ savedAt: Date.now() }),
}));

export function deriveSaveState(queue: AnnotationQueueState, savedAt: number | null): SaveState {
  if (queue.failure === "rejected") return "rejected";
  if (queue.failure === "retry") return "error";
  if (queue.sending || queue.pending > 0) return "saving";
  return savedAt === null ? "idle" : "saved";
}
