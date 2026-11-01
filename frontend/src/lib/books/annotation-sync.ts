import { useAnnotationSyncStore } from "@/stores/annotation-sync.store";
import { idbAvailable, idbGet, idbSet, idbDelete } from "@/lib/offline/idb-kv";
import { getMyBooksApi } from "./api";
import { AnnotationSaveQueue, type AnnotationOp, type DurableQueueStore } from "./annotation-queue";

/** Navbat IndexedDB'da (bo'sh bo'lsa kalit o'chiriladi). */
const idbQueueStore: DurableQueueStore = {
  load: (key) => idbGet<AnnotationOp[]>(key),
  save: (key, ops) => (ops.length === 0 ? idbDelete(key) : idbSet(key, ops)),
};

const queues = new Map<string, AnnotationSaveQueue>();

export function sendAnnotationOp(op: AnnotationOp): Promise<unknown> {
  return getMyBooksApi().savePageAnnotations(op.bookId, op.page, op.items);
}

/** Foydalanuvchi uchun yagona navbat; holati UI store'iga uzatiladi. */
export function getAnnotationQueue(userId: string): AnnotationSaveQueue {
  let queue = queues.get(userId);
  if (!queue) {
    queue = new AnnotationSaveQueue({
      userId,
      send: sendAnnotationOp,
      durable: idbAvailable() ? idbQueueStore : undefined,
      onChange: (state) => useAnnotationSyncStore.getState().setQueue(state),
      onSent: () => useAnnotationSyncStore.getState().markSaved(),
    });
    queues.set(userId, queue);
    useAnnotationSyncStore.getState().setQueue(queue.snapshot());
  }
  return queue;
}

/** Testlar uchun. */
export function resetAnnotationQueues() {
  queues.clear();
}

let scheduler: (() => void) | null = null;

/** `useAnnotationSync` o'zini shu yerda ro'yxatdan o'tkazadi; boshqa hook'lar yuborishni so'raydi. */
export function registerFlushScheduler(fn: (() => void) | null) {
  scheduler = fn;
}

export function requestAnnotationFlush() {
  scheduler?.();
}
