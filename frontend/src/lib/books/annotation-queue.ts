import { ApiError } from "@/lib/api/types";
import { isRetriable } from "@/lib/offline/write-queue";
import type { AnnotationItem } from "./annotations";

/** Serverga yoziladigan amal: "betning to'liq holati" — takror yuborish xavfsiz. */
export type AnnotationOp = {
  kind: "annotations";
  bookId: string;
  page: number;
  items: AnnotationItem[];
  at: string;
};

export type FlushResult = "idle" | "done" | "retry" | "rejected";

type QueueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Asinxron (IndexedDB) ombor: internet yo'qligida ham navbat sahifa yopilganda yo'qolmaydi. */
export interface DurableQueueStore {
  load: (key: string) => Promise<AnnotationOp[] | undefined>;
  save: (key: string, ops: AnnotationOp[]) => Promise<void>;
}

export interface AnnotationQueueOptions {
  /** Navbat shu foydalanuvchiga tegishli: boshqasining yozuvi hech qachon yuborilmaydi. */
  userId: string;
  send: (op: AnnotationOp) => Promise<unknown>;
  storage?: QueueStorage;
  /**
   * Asosiy ombor (brauzerda IndexedDB). Berilsa navbat unga yoziladi, `storage` (localStorage) esa
   * faqat eski yozuvlarni ko'chirish va IndexedDB yozolmagan holat uchun zaxira.
   */
  durable?: DurableQueueStore;
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

/** Eski versiyadagi yon daftar (`note`) amallari endi yuborilmaydi — tashlanadi. */
const onlyAnnotations = (ops: unknown[]): AnnotationOp[] =>
  ops.filter(
    (op): op is AnnotationOp =>
      typeof op === "object" && op !== null && (op as { kind?: unknown }).kind === "annotations",
  );

function readStored(storage: QueueStorage | undefined, key: string): AnnotationOp[] {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? onlyAnnotations(parsed) : [];
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
 * Chizmalar (annotatsiyalar) navbati. `enqueue` darhol omborga yozadi — brauzerda IndexedDB
 * (`durable`), bo'lmasa localStorage — sahifa yopilsa ham yo'qolmaydi; `flush` ketma-ket yuboradi. Vaqtincha xatoda (tarmoq, 5xx, 429) amal navbatda qoladi
 * va keyin qayta uriniladi; doimiy rad etilgan (4xx) amal tashlanadi va holatda ko'rsatiladi.
 */
export class AnnotationSaveQueue {
  private ops: AnnotationOp[];
  private flushing: Promise<FlushResult> | null = null;
  private state: AnnotationQueueState = { pending: 0, sending: false, failure: null, code: null };
  private readonly storageKey: string;
  private writing: Promise<void> = Promise.resolve();
  /** IndexedDB'dagi navbat xotiraga o'qildi (yuborish va `find` dan oldin kutiladi). */
  readonly ready: Promise<void>;

  constructor(private readonly options: AnnotationQueueOptions) {
    this.storageKey = `${ANNOTATION_QUEUE_PREFIX}${options.userId}`;
    this.ops = readStored(this.storage, this.storageKey);
    this.state = { ...this.state, pending: this.ops.length };
    const durable = options.durable;
    this.ready = durable
      ? durable
          .load(this.storageKey)
          .then((stored) => {
            // Xotiradagi (shu sessiyada yozilgan) amal saqlanganidan yangiroq: u ustun.
            const present = new Set(this.ops.map(annotationOpKey));
            const older = onlyAnnotations(Array.isArray(stored) ? stored : []).filter(
              (op) => !present.has(annotationOpKey(op)),
            );
            this.ops = [...older, ...this.ops].slice(-ANNOTATION_QUEUE_LIMIT);
            this.persist();
            this.update({});
          })
          .catch(() => undefined)
      : Promise.resolve();
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
  find(kind: AnnotationOp["kind"], bookId: string, page: number): AnnotationOp | undefined {
    const key = annotationOpKey({ kind, bookId, page });
    return this.ops.find((op) => annotationOpKey(op) === key);
  }

  private update(patch: Partial<AnnotationQueueState>) {
    this.state = { ...this.state, ...patch, pending: this.ops.length };
    this.options.onChange?.(this.state);
  }

  private persist() {
    const durable = this.options.durable;
    if (durable) {
      const snapshot = [...this.ops];
      this.writing = this.writing
        .then(() => durable.save(this.storageKey, snapshot))
        .then(() => {
          // Ko'chirildi: eski localStorage nusxasi kerak emas.
          try {
            this.storage?.removeItem(this.storageKey);
          } catch {
            // Bloklangan storage — e'tiborsiz.
          }
        })
        .catch(() => this.persistSync());
      return;
    }
    this.persistSync();
  }

  private persistSync() {
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
    const current = (this.flushing ?? Promise.resolve<FlushResult>("idle"))
      .then(() => this.ready)
      .then(() => this.drain());
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
