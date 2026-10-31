import { getApiSession, setApiSession } from "@/lib/api/session";
import { broadcastSessionEvent } from "./session-sync";
import { isLocale } from "@/lib/i18n/config";
import { ROUTES } from "@/lib/utils/routes";

/**
 * Brauzerda 401: sessiya (Auth.js cookie) serverda bir marta yangilanadi — bir vaqtda ko'p so'rov 401
 * olsa ham faqat bitta `getSession()` ketadi, qolganlari shu va'daga ulanadi. Yangilash natijasi:
 * `true` — sessiya tirik (so'rovni takrorlash mumkin), `false` — sessiya tugagan.
 */
let inflight: Promise<boolean> | null = null;

export function recoverSession(): Promise<boolean> {
  inflight ??= (async () => {
    try {
      const { getSession } = await import("next-auth/react");
      const session = await getSession();
      return Boolean(session?.user);
    } catch {
      return false;
    } finally {
      // Navbatdagi 401 to'lqini yangi yangilashni boshlay oladi.
      setTimeout(() => {
        inflight = null;
      }, 0);
    }
  })();
  return inflight;
}

/**
 * Tiklab bo'lmaydigan 401 (backend token/foydalanuvchini tanimaydi, lekin cookie hali "yaroqli":
 * kalit o'zgargan, baza tozalangan, sessiya bekor qilingan). Cookie ham tozalanadi, aks holda proxy
 * `/kirish` dan paneliga qaytaradi va aylana hosil bo'ladi. Parallel so'rovlar uchun bitta marta.
 */
let ending: Promise<void> | null = null;

export function endSession(): Promise<void> {
  ending ??= (async () => {
    try {
      const { signOut } = await import("next-auth/react");
      await signOut({ redirect: false });
    } catch {
      // Cookie tozalanmasa ham kirish sahifasiga o'tiladi.
    }
    setApiSession(null);
    broadcastSessionEvent("signed-out");
    redirectToLogin();
  })();
  return ending;
}

/** Kirgan foydalanuvchi uchun 401 qayta urinishga loyiqmi (mehmonning 401'i oddiy holat). */
export const shouldRecover = (status: number) =>
  status === 401 && typeof window !== "undefined" && getApiSession() !== null;

/** Sessiya tugagan: `/kirish?callbackUrl=<joriy sahifa>` (kirish sahifasida bo'lsa — hech narsa). */
export function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  const first = pathname.split("/")[1] ?? "";
  const locale = isLocale(first) ? first : "uz";
  const login = `/${locale}${ROUTES.login}`;
  if (pathname.startsWith(login)) return;
  const callbackUrl = new URLSearchParams({ callbackUrl: `${pathname}${search}` });
  // Qattiq o'tish ataylab: eski sessiya holati xotirada qolmasin.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `${login}?${callbackUrl}`;
}
