import type { QueryClient } from "@tanstack/react-query";
import { getApi } from "@/lib/api";
import { queryKeys } from "@/lib/api/query-keys";
import { useSyncStore } from "@/stores/sync.store";
import { SyncQueue } from "./queue";

export const SYNC_STORAGE_PREFIX = "maktab365-sync:";

const ACCOUNT_DATA_KEYS = [
  ["progress"],
  queryKeys.bookmarks(),
  queryKeys.dashboard(),
  queryKeys.results(),
  queryKeys.recent(),
  queryKeys.teacherDashboard(),
] as const;

/**
 * Optimistic yozilgan keshni (progress, xatcho'plar) serverdagi haqiqiy holatga qaytaradi:
 * faol bo'lmagan so'rovlar ham qayta yuklanadi, shunda eski optimistic qiymat qolib ketmaydi.
 */
export function rollbackOptimistic(queryClient: QueryClient): void {
  for (const queryKey of [["progress"], queryKeys.bookmarks()]) {
    void queryClient.invalidateQueries({ queryKey, refetchType: "all" });
  }
  refreshAccountData(queryClient);
}

/** Progressga bog'liq barcha so'rovlarni serverdan qayta o'qitadi. */
export function refreshAccountData(queryClient: QueryClient): void {
  for (const queryKey of ACCOUNT_DATA_KEYS) void queryClient.invalidateQueries({ queryKey });
}

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
      recordTopicOpened: (topicId) => getApi().recordTopicOpened(topicId),
    },
    storageKey: `${SYNC_STORAGE_PREFIX}${userId}`,
    storage: typeof localStorage === "undefined" ? undefined : localStorage,
    onChange: (items) => useSyncStore.getState().setPending(items),
    onSynced: (remaining) => {
      if (remaining > 0) return;
      refreshAccountData(queryClient);
    },
    // Server rad etgan yozuv: optimistic holat serverdagi haqiqiy holatga qaytariladi (rollback).
    onDropped: () => rollbackOptimistic(queryClient),
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
