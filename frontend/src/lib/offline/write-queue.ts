import { ApiError } from "@/lib/api/types";

/** Serverga yoziladigan o'qish amallari; har biri idempotent (takror yuborish xavfsiz). */
export type WriteOp =
  | { kind: "progress"; bookId: string; page: number; at: string }
  | { kind: "bookmark"; bookId: string; saved: boolean }
  | { kind: "event"; bookId: string; event: "book_opened" | "book_read" };

export type WriteOutcome = "sent" | "queued";

type QueueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface WriteQueueOptions {
  /** Navbat shu foydalanuvchiga tegishli: boshqasining yozuvi hech qachon yuborilmaydi. */
  userId: string;
  /** Bitta amalni serverga yuboradi; xatoda `ApiError` (yoki tarmoq xatosi) tashlaydi. */
  send: (op: WriteOp) => Promise<unknown>;
  storage?: QueueStorage;
  /** Muvaffaqiyatli yuborilgan (navbatdan o'tgan) amal haqida xabar. */
  onSent?: (op: WriteOp) => void;
}

export const WRITE_QUEUE_PREFIX = "maktab365-writes:";
/** Navbat shundan uzun o'smaydi: eng eski amallar tashlanadi (xotira va qayta yuborish chegarasi). */
export const WRITE_QUEUE_LIMIT = 200;

/** Bir kitob uchun bir xil turdagi amallar bitta kalitga tushadi: oxirgisi yutadi. */
export function opKey(op: WriteOp): string {
  return op.kind === "event" ? `event:${op.event}:${op.bookId}` : `${op.kind}:${op.bookId}`;
}

/**
 * Vaqtincha xato (tarmoq, timeout, 408/429/5xx): amal navbatda qoladi va keyin qayta uriniladi.
 * Qolgan 4xx — doimiy rad etish: qayta urinish befoyda, chaqiruvchi optimistic o'zgarishni qaytaradi.
 */
export function isRetriable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return (
      error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500
    );
  }
  return true; // `fetch` TypeError va boshqa kutilmagan tarmoq xatolari
}

function readStored(storage: QueueStorage | undefined, key: string): WriteOp[] {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WriteOp[]) : [];
  } catch {
    return [];
  }
}

/**
 * Oflayn/sekin internetda yozuvlar navbati. `run` amalni darhol yuborishga urinadi; vaqtincha
 * xatoda u brauzerda (localStorage) saqlanadi va `flush` (internet qaytganda, qayta kirganda,
 * taymer) qayta yuboradi. Navbat tartibi saqlanadi, bir xil kalitli amal oldingisini almashtiradi.
 */
export class WriteQueue {
  private ops: WriteOp[];
  private flushing: Promise<void> | null = null;
  private readonly rejected = new Map<WriteOp, unknown>();
  private readonly storageKey: string;

  constructor(private readonly options: WriteQueueOptions) {
    this.storageKey = `${WRITE_QUEUE_PREFIX}${options.userId}`;
    this.ops = readStored(this.storage, this.storageKey);
  }

  private get storage(): QueueStorage | undefined {
    if (this.options.storage) return this.options.storage;
    return typeof localStorage === "undefined" ? undefined : localStorage;
  }

  get size(): number {
    return this.ops.length;
  }

  pending(): readonly WriteOp[] {
    return this.ops;
  }

  private persist() {
    try {
      if (this.ops.length === 0) this.storage?.removeItem(this.storageKey);
      else this.storage?.setItem(this.storageKey, JSON.stringify(this.ops));
    } catch {
      // Xotira to'la yoki bloklangan: navbat faqat xotirada ishlaydi.
    }
  }

  private enqueue(op: WriteOp) {
    const key = opKey(op);
    this.ops = [...this.ops.filter((existing) => opKey(existing) !== key), op].slice(
      -WRITE_QUEUE_LIMIT,
    );
    this.persist();
  }

  private remove(op: WriteOp) {
    // Yuborish paytida shu kalitga yangi amal tushgan bo'lsa (`!==`), u navbatda qoladi.
    this.ops = this.ops.filter((existing) => existing !== op);
    this.persist();
  }

  /**
   * Amalni navbatga qo'yadi va yuboradi. `sent` — server qabul qildi; `queued` — vaqtincha xato,
   * navbatda qoldi. Doimiy rad etilsa (4xx) amal navbatdan olinadi va xato tashlanadi.
   */
  async run(op: WriteOp): Promise<WriteOutcome> {
    this.enqueue(op);
    await this.flush();
    if (this.rejected.has(op)) {
      const error = this.rejected.get(op);
      this.rejected.delete(op);
      throw error;
    }
    return this.ops.includes(op) ? "queued" : "sent";
  }

  /**
   * Navbatni tartib bilan yuboradi. Vaqtincha xatoda to'xtaydi (keyingilarni urib ko'rmaydi:
   * internet yo'q). Doimiy rad etilgan amallar tashlanadi va `run` ularning xatosini qaytaradi.
   */
  flush(): Promise<void> {
    const current = (this.flushing ?? Promise.resolve()).then(() => this.drain());
    this.flushing = current.catch(() => undefined);
    return current;
  }

  private async drain() {
    for (const op of [...this.ops]) {
      if (!this.ops.includes(op)) continue; // flush kutayotganda almashtirilgan
      try {
        await this.options.send(op);
      } catch (error) {
        if (isRetriable(error)) return;
        this.rejected.set(op, error);
        this.remove(op);
        continue;
      }
      this.remove(op);
      this.options.onSent?.(op);
    }
  }
}
