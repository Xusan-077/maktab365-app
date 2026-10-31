import { useAnnotationSyncStore } from "@/stores/annotation-sync.store";
import { getMyBooksApi } from "./api";
import { AnnotationSaveQueue, type AnnotationOp } from "./annotation-queue";

const queues = new Map<string, AnnotationSaveQueue>();

export function sendAnnotationOp(op: AnnotationOp): Promise<unknown> {
  const api = getMyBooksApi();
  return op.kind === "annotations"
    ? api.savePageAnnotations(op.bookId, op.page, op.items)
    : api.saveNote(op.bookId, op.page, op.text);
}

/** Foydalanuvchi uchun yagona navbat; holati UI store'iga uzatiladi. */
export function getAnnotationQueue(userId: string): AnnotationSaveQueue {
  let queue = queues.get(userId);
  if (!queue) {
    queue = new AnnotationSaveQueue({
      userId,
      send: sendAnnotationOp,
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
