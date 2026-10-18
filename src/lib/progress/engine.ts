import type { QueryClient } from "@tanstack/react-query";
import { getApi } from "@/lib/api";
import { queryKeys } from "@/lib/api/query-keys";
import { useSyncStore } from "@/stores/sync.store";
import { SyncQueue } from "./queue";

export const SYNC_STORAGE_PREFIX = "maktab365-sync:";

let active: { userId: string; queue: SyncQueue } | null = null;

/**
 * Akkaunt uchun yagona yozuv navbati (har foydalanuvchiga alohida, localStorage'da saqlanadi).
 * Navbat bo'shaganda progress va xatcho'plar serverdagi haqiqiy holat bilan solishtiriladi.
 */
export function getSyncQueue(userId: string, queryClient: QueryClient): SyncQueue {
  if (active?.userId === userId) return active.queue;
  stopSync();
  const queue = new SyncQueue({
    api: {
      saveProgress: (input) => getApi().saveProgress(input),
      setBookmark: (topicId, bookmarked) => getApi().setBookmark(topicId, bookmarked),
    },
    storageKey: `${SYNC_STORAGE_PREFIX}${userId}`,
    storage: typeof localStorage === "undefined" ? undefined : localStorage,
    onChange: (items) => useSyncStore.getState().setPending(items),
    onSynced: (remaining) => {
      if (remaining > 0) return;
      void queryClient.invalidateQueries({ queryKey: ["progress"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks() });
    },
  });
  active = { userId, queue };
  useSyncStore.getState().setPending(queue.pending);
  return queue;
}

/** Foydalanuvchi chiqqanda/almashganda navbatni to'xtatadi (saqlangan yozuvlar keyingi kirishda yuboriladi). */
export function stopSync(): void {
  active?.queue.dispose();
  active = null;
  useSyncStore.getState().setPending([]);
}
