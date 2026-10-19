import { create } from "zustand";
import type { SyncItem } from "@/lib/progress/queue";

interface SyncState {
  /** Hali serverga yuborilmagan yozuvlar (oflayn navbat). UI shu bilan "yuborilmoqda" holatini ko'rsatadi. */
  pending: readonly SyncItem[];
  setPending: (pending: readonly SyncItem[]) => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  pending: [],
  setPending: (pending) => set({ pending }),
}));
