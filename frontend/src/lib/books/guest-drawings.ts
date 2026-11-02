import { idbAvailable, idbDelete, idbGet, idbSet } from "@/lib/offline/idb-kv";
import type { AnnotationItem } from "./annotations";

/**
 * O'qish oynasidagi chizmalar — mehmonda ham, kirgan foydalanuvchida ham faqat shu qurilmada
 * (serverga yuborilmaydi): kitob bo'yicha bitta yozuv `{ [bet]: items }`. Brauzerda IndexedDB,
 * bo'lmasa localStorage (`useDrawings`). Kalit nomi eski — avvalgi chizmalar yo'qolmasin.
 */
export const GUEST_DRAWINGS_PREFIX = "maktab365-guest-drawings:";

export type GuestPages = Record<number, AnnotationItem[]>;

export interface GuestDrawingsBackend {
  get: (key: string) => Promise<GuestPages | undefined>;
  set: (key: string, value: GuestPages) => Promise<void>;
  remove: (key: string) => Promise<void>;
}

const localBackend: GuestDrawingsBackend = {
  get: async (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as GuestPages) : undefined;
    } catch {
      return undefined;
    }
  },
  set: async (key, value) => localStorage.setItem(key, JSON.stringify(value)),
  remove: async (key) => localStorage.removeItem(key),
};

const idbBackend: GuestDrawingsBackend = {
  get: (key) => idbGet<GuestPages>(key),
  set: (key, value) => idbSet(key, value),
  remove: (key) => idbDelete(key),
};

export function defaultGuestBackend(): GuestDrawingsBackend {
  return idbAvailable() ? idbBackend : localBackend;
}

function sanitize(value: unknown): GuestPages {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const pages: GuestPages = {};
  for (const [key, items] of Object.entries(value)) {
    const page = Number(key);
    if (Number.isInteger(page) && page >= 1 && Array.isArray(items) && items.length > 0) {
      pages[page] = items as AnnotationItem[];
    }
  }
  return pages;
}

/**
 * Bitta kitobning qurilmadagi chizmalari. Yozuvlar ketma-ket (oldingisi tugagach) bajariladi — tez
 * chizilganda eski holat yangisining ustiga yozilib qolmaydi.
 */
export class GuestDrawings {
  private chain: Promise<unknown> = Promise.resolve();
  private readonly key: string;

  constructor(
    bookId: string,
    private readonly backend: GuestDrawingsBackend = defaultGuestBackend(),
  ) {
    this.key = `${GUEST_DRAWINGS_PREFIX}${bookId}`;
  }

  private queue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.chain.then(task, task);
    this.chain = next.catch(() => undefined);
    return next;
  }

  load(): Promise<GuestPages> {
    return this.queue(async () =>
      sanitize(await this.backend.get(this.key).catch(() => undefined)),
    );
  }

  /** Bet holatini yozadi (bo'sh ro'yxat — bet o'chiriladi). */
  savePage(page: number, items: AnnotationItem[]): Promise<void> {
    return this.queue(async () => {
      const pages = sanitize(await this.backend.get(this.key).catch(() => undefined));
      if (items.length === 0) delete pages[page];
      else pages[page] = items;
      if (Object.keys(pages).length === 0) await this.backend.remove(this.key);
      else await this.backend.set(this.key, pages);
    });
  }

  /** Kitobning barcha chizmalari o'chiriladi. */
  clear(): Promise<void> {
    return this.queue(() => this.backend.remove(this.key));
  }
}
