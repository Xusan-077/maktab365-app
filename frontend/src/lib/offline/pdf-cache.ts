/**
 * Oflayn saqlangan PDF kitoblar: butun fayl Cache Storage'da (`maktab365-pdf-v1`), ro'yxat
 * (nom, hajm, sana) `localStorage`da. Faylni o'qish sahifaning o'zidan (`caches.match` → pdf.js
 * `data`), shuning uchun Service Worker'da Range mantiqi kerak emas.
 */
import type { LocalizedText } from "@/types/i18n";

export const OFFLINE_CACHE = "maktab365-pdf-v1";
export const OFFLINE_REGISTRY_KEY = "maktab365-offline-books";
/** Shundan katta fayl uchun saqlashdan oldin ogohlantirish ko'rsatiladi. */
export const LARGE_DOWNLOAD_BYTES = 50 * 1024 * 1024;
/** Xotira kvotasining shuncha qismidan ortig'i band bo'lsa saqlash ogohlantiriladi. */
export const QUOTA_SAFETY = 0.9;

export interface OfflineBook {
  id: string;
  slug: string;
  grade: number;
  title: LocalizedText;
  sizeBytes: number;
  savedAt: string;
}

/** Cache Storage kaliti: hech qachon haqiqiy URL bilan to'qnashmaydi. */
export const offlineKey = (bookId: string) => `/__offline__/pdf/${bookId}`;

export function sanitizeRegistry(value: unknown): OfflineBook[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is OfflineBook =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as OfflineBook).id === "string" &&
      typeof (item as OfflineBook).slug === "string" &&
      typeof (item as OfflineBook).grade === "number" &&
      typeof (item as OfflineBook).sizeBytes === "number" &&
      typeof (item as OfflineBook).title === "object" &&
      (item as OfflineBook).title !== null,
  );
}

export function readRegistry(storage: Pick<Storage, "getItem"> = localStorage): OfflineBook[] {
  try {
    return sanitizeRegistry(JSON.parse(storage.getItem(OFFLINE_REGISTRY_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function writeRegistry(items: OfflineBook[], storage: Pick<Storage, "setItem"> = localStorage) {
  try {
    storage.setItem(OFFLINE_REGISTRY_KEY, JSON.stringify(items));
  } catch {
    // Storage yopiq: ro'yxat saqlanmaydi (fayl kesh'da qoladi, lekin boshqaruvda ko'rinmaydi).
  }
}

/** Ro'yxatga qo'shadi/almashtiradi (id bo'yicha), eng yangisi birinchi. */
export function upsertRegistry(items: OfflineBook[], book: OfflineBook): OfflineBook[] {
  return [book, ...items.filter((item) => item.id !== book.id)];
}

export interface StorageInfo {
  usage: number;
  quota: number;
}

/** Saqlashdan oldin ogohlantirish kerakmi: katta fayl yoki xotira yetmasligi mumkin. */
export function downloadWarnings(
  sizeBytes: number,
  storage: StorageInfo | null,
): ("large" | "space")[] {
  const warnings: ("large" | "space")[] = [];
  if (sizeBytes >= LARGE_DOWNLOAD_BYTES) warnings.push("large");
  if (storage && storage.quota > 0 && storage.usage + sizeBytes > storage.quota * QUOTA_SAFETY) {
    warnings.push("space");
  }
  return warnings;
}

export const isOfflineSupported = () => typeof caches !== "undefined";

export async function storageEstimate(): Promise<StorageInfo | null> {
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return usage === undefined || quota === undefined ? null : { usage, quota };
  } catch {
    return null;
  }
}

export async function isSavedOffline(bookId: string): Promise<boolean> {
  if (!isOfflineSupported()) return false;
  try {
    return Boolean(await (await caches.open(OFFLINE_CACHE)).match(offlineKey(bookId)));
  } catch {
    return false;
  }
}

/** Saqlangan faylning baytlari (yo'q bo'lsa `null`). */
export async function loadOfflinePdf(bookId: string): Promise<Uint8Array | null> {
  if (!isOfflineSupported()) return null;
  try {
    const response = await (await caches.open(OFFLINE_CACHE)).match(offlineKey(bookId));
    return response ? new Uint8Array(await response.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/**
 * Faylni oqim bilan yuklab (`onProgress` 0..1) kesh'ga yozadi va ro'yxatga qo'shadi. Bekor qilinsa
 * yoki yiqilsa hech narsa saqlanmaydi.
 */
export async function savePdfOffline(options: {
  book: Omit<OfflineBook, "sizeBytes" | "savedAt">;
  url: string;
  expectedBytes?: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<OfflineBook> {
  const response = await fetch(options.url, { signal: options.signal });
  if (!response.ok || !response.body) throw new Error(`download_failed_${response.status}`);
  const total = Number(response.headers.get("content-length")) || options.expectedBytes || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array<ArrayBuffer>);
    received += value.length;
    if (total > 0) options.onProgress?.(Math.min(1, received / total));
  }
  const blob = new Blob(chunks, { type: "application/pdf" });
  const cache = await caches.open(OFFLINE_CACHE);
  await cache.put(
    offlineKey(options.book.id),
    new Response(blob, {
      headers: { "content-type": "application/pdf", "content-length": String(blob.size) },
    }),
  );
  options.onProgress?.(1);
  const saved: OfflineBook = {
    ...options.book,
    sizeBytes: blob.size,
    savedAt: new Date().toISOString(),
  };
  writeRegistry(upsertRegistry(readRegistry(), saved));
  return saved;
}

export async function removeOffline(bookId: string): Promise<void> {
  if (isOfflineSupported()) {
    try {
      await (await caches.open(OFFLINE_CACHE)).delete(offlineKey(bookId));
    } catch {
      // Kesh o'chmasa ham ro'yxatdan olib tashlanadi.
    }
  }
  writeRegistry(readRegistry().filter((item) => item.id !== bookId));
}

export async function clearOffline(): Promise<void> {
  if (isOfflineSupported()) {
    try {
      await caches.delete(OFFLINE_CACHE);
    } catch {
      // e'tiborsiz
    }
  }
  writeRegistry([]);
}

export const totalOfflineBytes = (items: readonly OfflineBook[]) =>
  items.reduce((sum, item) => sum + item.sizeBytes, 0);
