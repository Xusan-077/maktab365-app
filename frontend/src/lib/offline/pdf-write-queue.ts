import { getPdfBooksApi, type PdfBooksApi } from "@/lib/pdf-books/api";
import { WriteQueue, type WriteOp } from "./write-queue";

/** Navbatdagi amalni mos API chaqiruviga aylantiradi (hammasi idempotent). */
export function sendWriteOp(
  api: Pick<PdfBooksApi, "saveProgress" | "addBookmark" | "removeBookmark" | "recordEvent">,
) {
  return (op: WriteOp): Promise<unknown> => {
    switch (op.kind) {
      case "progress":
        return api.saveProgress(op.bookId, op.page, op.at);
      case "bookmark":
        return op.saved ? api.addBookmark(op.bookId) : api.removeBookmark(op.bookId);
      case "event":
        return api.recordEvent(op.bookId, op.event);
    }
  };
}

type Listener = (op: WriteOp) => void;

const queues = new Map<string, WriteQueue>();
const sentListeners = new Set<Listener>();

/** Yuborilgan amallar haqida xabar oladi (masalan, keshni yangilash uchun). */
export function onWriteSent(listener: Listener): () => void {
  sentListeners.add(listener);
  return () => sentListeners.delete(listener);
}

/** Testlar uchun: xotiradagi navbatlar tashlanadi (localStorage'ga tegmaydi). */
export function resetWriteQueues() {
  queues.clear();
  sentListeners.clear();
}

/** Foydalanuvchi uchun yagona navbat (har foydalanuvchining yozuvlari alohida saqlanadi). */
export function getWriteQueue(userId: string): WriteQueue {
  let queue = queues.get(userId);
  if (!queue) {
    queue = new WriteQueue({
      userId,
      send: sendWriteOp(getPdfBooksApi()),
      onSent: (op) => sentListeners.forEach((listener) => listener(op)),
    });
    queues.set(userId, queue);
  }
  return queue;
}
