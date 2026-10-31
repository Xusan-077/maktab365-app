import { ApiError } from "@/lib/api/types";
import { isRetriable } from "@/lib/offline/write-queue";
import type { AnnotationItem } from "./annotations";

/** Serverga yoziladigan amallar; ikkalasi ham "betning to'liq holati" — takror yuborish xavfsiz. */
export type AnnotationOp =
  | { kind: "annotations"; bookId: string; page: number; items: AnnotationItem[]; at: string }
  | { kind: "note"; bookId: string; page: number; text: string; at: string };

export type FlushResult = "idle" | "done" | "retry" | "rejected";

type QueueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface AnnotationQueueOptions {
  /** Navbat shu foydalanuvchiga tegishli: boshqasining yozuvi hech qachon yuborilmaydi. */
  userId: string;
  send: (op: AnnotationOp) => Promise<unknown>;
  storage?: QueueStorage;
  /** Navbat holati o'zgarganda (UI "Saqlanmoqda…" ko'rsatkichi uchun). */
  onChange?: (state: AnnotationQueueState) => void;
  /** Muvaffaqiyatli yuborilgan amal. */
  onSent?: (op: AnnotationOp, response: unknown) => void;
}

export interface AnnotationQueueState {
  pending: number;
  sending: boolean;
  /** Oxirgi urinish natijasi: `retry` — vaqtincha xato, `rejected` — server rad etdi. */
  failure: "retry" | "rejected" | null;
  /** `rejected` bo'lganda server xato kodi (masalan `page_too_large`). */
  code: string | null;
}

export const ANNOTATION_QUEUE_PREFIX = "maktab365-annotations:";
/** Navbat shundan uzun o'smaydi (har bet uchun bitta yozuv: amalda 200 betdan kam). */
export const ANNOTATION_QUEUE_LIMIT = 200;

/** Bir bet uchun bir turdagi amallar bitta kalitga tushadi: oxirgisi yutadi. */
export function annotationOpKey(op: Pick<AnnotationOp, "kind" | "bookId" | "page">): string {
  return `${op.kind}:${op.bookId}:${op.page}`;
}

function readStored(storage: QueueStorage | undefined, key: string): AnnotationOp[] {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AnnotationOp[]) : [];
  } catch {
    return [];
  }
}

function errorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const details = JSON.stringify(error.details ?? {});
  for (const code of ["page_too_large", "too_many_annotations", "too_many_points", "id_conflict"]) {
    if (details.includes(code)) return code;
  }
  return error.code ?? null;
}

/**
 * Yozuv va annotatsiyalar navbati. `enqueue` darhol localStorage'ga yozadi (sahifa yopilsa ham
 * yo'qolmaydi), `flush` ketma-ket yuboradi. Vaqtincha xatoda (tarmoq, 5xx, 429) amal navbatda qoladi
 * va keyin qayta uriniladi; doimiy rad etilgan (4xx) amal tashlanadi va holatda ko'rsatiladi.
 */
export class AnnotationSaveQueue {
  private ops: AnnotationOp[];
  private flushing: Promise<FlushResult> | null = null;
  private state: AnnotationQueueState = { pending: 0, sending: false, failure: null, code: null };
  private readonly storageKey: string;

  constructor(private readonly options: AnnotationQueueOptions) {
    this.storageKey = `${ANNOTATION_QUEUE_PREFIX}${options.userId}`;
    this.ops = readStored(this.storage, this.storageKey);
    this.state = { ...this.state, pending: this.ops.length };
  }

  private get storage(): QueueStorage | undefined {
    if (this.options.storage) return this.options.storage;
    return typeof localStorage === "undefined" ? undefined : localStorage;
  }

  get size(): number {
    return this.ops.length;
  }

  snapshot(): AnnotationQueueState {
    return this.state;
  }

  /** Hali yuborilmagan holat (sahifa yangilangandan keyin server ma'lumotidan ustun turadi). */
  find<K extends AnnotationOp["kind"]>(
    kind: K,
    bookId: string,
    page: number,
  ): Extract<AnnotationOp, { kind: K }> | undefined {
    const key = annotationOpKey({ kind, bookId, page });
    return this.ops.find((op) => annotationOpKey(op) === key) as
      Extract<AnnotationOp, { kind: K }> | undefined;
  }

  private update(patch: Partial<AnnotationQueueState>) {
    this.state = { ...this.state, ...patch, pending: this.ops.length };
    this.options.onChange?.(this.state);
  }

  private persist() {
    try {
      if (this.ops.length === 0) this.storage?.removeItem(this.storageKey);
      else this.storage?.setItem(this.storageKey, JSON.stringify(this.ops));
    } catch {
      // Xotira to'la yoki bloklangan: navbat faqat xotirada ishlaydi.
    }
  }

  enqueue(op: AnnotationOp): void {
    const key = annotationOpKey(op);
    this.ops = [...this.ops.filter((existing) => annotationOpKey(existing) !== key), op].slice(
      -ANNOTATION_QUEUE_LIMIT,
    );
    this.persist();
    this.update({ failure: null, code: null });
  }

  private remove(op: AnnotationOp) {
    // Yuborish paytida shu kalitga yangi amal tushgan bo'lsa (boshqa obyekt), u navbatda qoladi.
    this.ops = this.ops.filter((existing) => existing !== op);
    this.persist();
  }

  /** Navbatni tartib bilan yuboradi; bir vaqtda faqat bitta `flush` ishlaydi. */
  flush(): Promise<FlushResult> {
    const current = (this.flushing ?? Promise.resolve<FlushResult>("idle")).then(() =>
      this.drain(),
    );
    this.flushing = current.catch((): FlushResult => "retry");
    return current;
  }

  private async drain(): Promise<FlushResult> {
    if (this.ops.length === 0) {
      this.update({ sending: false });
      return "idle";
    }
    this.update({ sending: true });
    let rejected: string | null = null;
    for (const op of [...this.ops]) {
      if (!this.ops.includes(op)) continue; // flush kutayotganda almashtirilgan
      try {
        const response = await this.options.send(op);
        this.remove(op);
        this.options.onSent?.(op, response);
      } catch (error) {
        if (isRetriable(error)) {
          this.update({ sending: false, failure: "retry" });
          return "retry";
        }
        rejected = errorCode(error) ?? "rejected";
        this.remove(op);
      }
    }
    if (rejected !== null) {
      this.update({ sending: false, failure: "rejected", code: rejected });
      return "rejected";
    }
    this.update({ sending: false, failure: null, code: null });
    return "done";
  }
}
