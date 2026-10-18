import { ApiError } from "@/lib/api/types";
import type { SaveProgressInput } from "@/types/progress";

/** Serverga yuborilishi kutilayotgan yozuv. Ikkalasi ham to'liq holat (delta emas), shuning uchun takror yuborish xavfsiz. */
export type SyncItem =
  | { kind: "progress"; topicId: string; input: SaveProgressInput }
  | { kind: "bookmark"; topicId: string; bookmarked: boolean };

export interface SyncApi {
  saveProgress(input: SaveProgressInput): Promise<unknown>;
  setBookmark(topicId: string, bookmarked: boolean): Promise<unknown>;
}

type SyncStorage = Pick<Storage, "getItem" | "setItem">;

export interface SyncQueueOptions {
  api: SyncApi;
  storageKey: string;
  storage?: SyncStorage;
  /** Oflayn bo'lsa so'rov yuborilmaydi (default: `navigator.onLine`). */
  isOnline?: () => boolean;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  cancel?: (handle: unknown) => void;
  /** Navbat o'zgarganda (qo'shildi/yuborildi). */
  onChange?: (items: readonly SyncItem[]) => void;
  /** Kamida bitta yozuv yuborilgan flush tugaganda. */
  onSynced?: (remaining: number) => void;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const keyOf = (item: SyncItem) => `${item.kind}:${item.topicId}`;

/** Qayta urinish foyda bermaydigan xatolar: so'rov noto'g'ri yoki mavzu yo'q (4xx, 408/429/401 dan tashqari). */
export function isPermanentError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  const { status } = error;
  return status >= 400 && status < 500 && ![401, 408, 429].includes(status);
}

function loadItems(storage: SyncStorage | undefined, key: string): SyncItem[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(key) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SyncItem =>
        typeof item === "object" &&
        item !== null &&
        (item.kind === "progress" || item.kind === "bookmark") &&
        typeof item.topicId === "string",
    );
  } catch {
    return [];
  }
}

/**
 * Oflayn/sekin internet uchun yozuvlar navbati. Yozuvlar localStorage'da saqlanadi (sahifa
 * yopilsa ham yo'qolmaydi), bir mavzu uchun faqat eng so'nggisi qoladi, xatoda eksponensial
 * kechikish bilan qayta uriniladi.
 */
export class SyncQueue {
  private items: SyncItem[];
  private flushing: Promise<void> | null = null;
  private timer: unknown = null;
  private failures = 0;
  private disposed = false;
  private rerun = false;

  constructor(private readonly options: SyncQueueOptions) {
    this.items = loadItems(options.storage, options.storageKey);
  }

  get pending(): readonly SyncItem[] {
    return this.items;
  }

  enqueue(item: SyncItem): void {
    const index = this.items.findIndex((existing) => keyOf(existing) === keyOf(item));
    if (index === -1) this.items = [...this.items, item];
    else this.items = this.items.map((existing, i) => (i === index ? item : existing));
    this.changed();
    void this.flush();
  }

  /** Navbatni yuboradi. Bir vaqtda bitta flush ishlaydi; u ishlayotganda chaqirilsa, tugagach yana bir marta o'tadi. */
  flush(): Promise<void> {
    if (this.flushing) {
      this.rerun = true;
      return this.flushing;
    }
    this.flushing = (async () => {
      do {
        this.rerun = false;
        await this.run();
      } while (this.rerun && !this.disposed);
    })().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
  }

  private online(): boolean {
    if (this.options.isOnline) return this.options.isOnline();
    return typeof navigator === "undefined" || navigator.onLine !== false;
  }

  private async run(): Promise<void> {
    this.clearTimer();
    let sent = 0;
    while (this.items.length > 0 && !this.disposed) {
      if (!this.online()) {
        this.scheduleRetry();
        break;
      }
      const item = this.items[0];
      try {
        await this.send(item);
      } catch (error) {
        if (isPermanentError(error)) {
          this.remove(item);
          continue;
        }
        this.failures++;
        this.scheduleRetry();
        break;
      }
      this.failures = 0;
      this.remove(item);
      sent++;
    }
    if (sent > 0) this.options.onSynced?.(this.items.length);
  }

  private send(item: SyncItem): Promise<unknown> {
    const { api } = this.options;
    return item.kind === "progress"
      ? api.saveProgress(item.input)
      : api.setBookmark(item.topicId, item.bookmarked);
  }

  /** Yuborilgan yozuvni olib tashlaydi; kutish paytida yangisi bilan almashtirilgan bo'lsa, qoladi. */
  private remove(item: SyncItem): void {
    if (!this.items.includes(item)) return;
    this.items = this.items.filter((existing) => existing !== item);
    this.changed();
  }

  private changed(): void {
    try {
      this.options.storage?.setItem(this.options.storageKey, JSON.stringify(this.items));
    } catch {
      // joy yetmasa ham xotiradagi navbat ishlayveradi
    }
    this.options.onChange?.(this.items);
  }

  private scheduleRetry(): void {
    if (this.timer !== null || this.disposed) return;
    const { baseDelayMs = 1000, maxDelayMs = 60_000, schedule = setTimeout } = this.options;
    const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, this.failures - 1));
    this.timer = schedule(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    (this.options.cancel ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>);
    this.timer = null;
  }
}

/**
 * Serverdan kelgan ro'yxat ustiga hali yuborilmagan yozuvlarni qo'yadi: kutish paytida so'rov
 * qayta yuklansa ham foydalanuvchi o'z o'zgarishlarini ko'radi.
 */
export function overlayProgress<T extends { topicId: string }>(
  server: T[],
  pending: readonly SyncItem[],
  build: (input: SaveProgressInput, existing: T | undefined) => T,
): T[] {
  const byTopic = new Map(server.map((item) => [item.topicId, item]));
  for (const item of pending) {
    if (item.kind === "progress")
      byTopic.set(item.topicId, build(item.input, byTopic.get(item.topicId)));
  }
  return [...byTopic.values()];
}
