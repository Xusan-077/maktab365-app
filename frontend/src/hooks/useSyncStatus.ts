import { useSyncStore } from "@/stores/sync.store";

/** Serverga yuborilmagan yozuvlar soni (oflayn yoki sekin internetda 0 dan katta bo'ladi). */
export function useSyncStatus() {
  const pending = useSyncStore((state) => state.pending.length);
  return { pending, synced: pending === 0 };
}
