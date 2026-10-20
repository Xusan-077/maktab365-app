import type { RefreshResult } from "./backend";
import type { BackendTokens } from "./tokens";

/**
 * Refresh bir martalik (backend rotation + blacklist), shuning uchun bitta refresh tokenni
 * bir vaqtda ikki joy almashtirsa, ikkinchisi sessiyani yo'qotadi. Bu modul:
 * - bir xil token uchun parallel chaqiruvlarni bitta so'rovga birlashtiradi (single-flight);
 * - natijani qisqa muddat eslab qoladi: proxy almashtirgan tokenni o'sha so'rovdagi RSC/BFF
 *   (cookie hali eski) `rotatedTokens` orqali topadi.
 * Holat `globalThis` da: proxy va route handler'lar alohida bundle bo'lsa ham bitta jarayonda umumiy.
 */

export const ROTATION_MEMO_MS = 60_000;

interface Entry {
  promise: Promise<RefreshResult>;
  result?: RefreshResult;
  settledAt?: number;
}

const STORE_KEY = Symbol.for("maktab365.auth.refresh");
type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: Map<string, Entry> };

function store(): Map<string, Entry> {
  const scope = globalThis as GlobalWithStore;
  return (scope[STORE_KEY] ??= new Map());
}

function sweep(now: number) {
  for (const [key, entry] of store()) {
    if (entry.settledAt !== undefined && now - entry.settledAt > ROTATION_MEMO_MS) {
      store().delete(key);
    }
  }
}

export function refreshOnce(
  refresh: string,
  run: (refresh: string) => Promise<RefreshResult>,
  now: () => number = Date.now,
): Promise<RefreshResult> {
  sweep(now());
  const existing = store().get(refresh);
  if (existing) return existing.promise;

  const entry: Entry = {
    promise: run(refresh).then((result) => {
      if (!result.ok && result.reason === "unavailable") {
        // Tarmoq xatosi eslab qolinmaydi — keyingi so'rov qayta uradi.
        store().delete(refresh);
      } else {
        entry.result = result;
        entry.settledAt = now();
      }
      return result;
    }),
  };
  store().set(refresh, entry);
  return entry.promise;
}

/** Shu refresh yaqinda almashtirilgan bo'lsa — yangi juftlik. */
export function rotatedTokens(refresh: string, now: number = Date.now()): BackendTokens | null {
  const entry = store().get(refresh);
  if (!entry?.result?.ok || entry.settledAt === undefined) return null;
  return now - entry.settledAt <= ROTATION_MEMO_MS ? entry.result.tokens : null;
}

/** Testlar uchun. */
export function resetRefreshStore() {
  store().clear();
}
