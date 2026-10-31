import { safeCallbackPath } from "@/lib/utils/routes";

/**
 * Google kirishi sahifadan chiqib ketadi (OAuth), qaytganda esa onboarding/panelga tushadi.
 * Shuning uchun chiqishdan oldin joriy sahifa (yo'l + query) qisqa muddatga `sessionStorage` ga
 * yoziladi va kirgandan keyin shu sahifaga qaytiladi.
 */

export const RETURN_TO_KEY = "maktab365-return-to";
export const RETURN_TO_TTL_MS = 15 * 60 * 1000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const defaultStore = (): Store | null => {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
};

/** Kirish/onboarding sahifasidan qaytish ma'nosiz: shundan chiqib ketilgan. */
const AUTH_PATH = /^\/(?:[^/]+\/)?(?:kirish|royxatdan-otish|kod|onboarding)(?:\/|\?|$)/;

export function saveReturnTo(
  path: string,
  now = Date.now(),
  store: Store | null = defaultStore(),
): boolean {
  const safe = safeCallbackPath(path);
  if (!safe || AUTH_PATH.test(safe) || !store) return false;
  try {
    store.setItem(RETURN_TO_KEY, JSON.stringify({ path: safe, at: now }));
    return true;
  } catch {
    return false;
  }
}

/** Saqlangan yo'lni bir marta o'qiydi (o'chiradi); muddati o'tgan yoki yaroqsiz bo'lsa `null`. */
export function takeReturnTo(
  now = Date.now(),
  store: Store | null = defaultStore(),
): string | null {
  if (!store) return null;
  try {
    const raw = store.getItem(RETURN_TO_KEY);
    if (raw === null) return null;
    store.removeItem(RETURN_TO_KEY);
    const parsed = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof parsed.path !== "string" || typeof parsed.at !== "number") return null;
    if (now - parsed.at > RETURN_TO_TTL_MS || now < parsed.at) return null;
    return safeCallbackPath(parsed.path) ?? null;
  } catch {
    return null;
  }
}

/** Google'dan qaytib tushadigan sahifalar (til prefiksisiz): shu yerdagina saqlangan yo'lga qaytariladi. */
export function isReturnLanding(pathname: string): boolean {
  const path = pathname.replace(/^\/[^/]+(?=\/)/, "") || "/";
  return path === "/kabinet" || path === "/ustoz";
}
