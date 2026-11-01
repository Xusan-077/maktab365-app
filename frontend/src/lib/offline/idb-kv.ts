/**
 * Juda kichik IndexedDB kalit-qiymat ombori (bitta baza, bitta object store). Chizmalar navbati va
 * mehmon chizmalari uchun: `localStorage` dan katta hajm sig'adi va asosiy oqimni bloklamaydi.
 * IndexedDB bo'lmasa (SSR, eski brauzer, ba'zi maxfiy oynalar) `null`/xato qaytadi — chaqiruvchi
 * `localStorage` zaxirasiga o'tadi.
 */

const DB_NAME = "maktab365";
const STORE = "kv";
const VERSION = 1;

let opening: Promise<IDBDatabase> | null = null;

export function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      // Boshqa tab bazani yangilasa — ulanish yopiladi, keyingi chaqiruv qayta ochadi.
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("indexedDB open failed"));
    request.onblocked = () => reject(new Error("indexedDB blocked"));
  });
  opening.catch(() => {
    opening = null;
  });
  return opening;
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error ?? request.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("indexedDB aborted"));
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  return (await run("readonly", (store) => store.get(key))) as T | undefined;
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  await run("readwrite", (store) => store.put(value, key));
}

export async function idbDelete(key: string): Promise<void> {
  await run("readwrite", (store) => store.delete(key));
}
