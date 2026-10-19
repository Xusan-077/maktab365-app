import { locales } from "@/lib/i18n/config";

/** Sessiyada splash ko'rsatilganini eslab qoladi (sessionStorage). */
export const SPLASH_STORAGE_KEY = "m365_splash_seen";

/** Umumiy davomiylik; oxirgi 0.3 s — fade-out (CSS bilan bir xil bo'lishi kerak). */
export const SPLASH_DURATION_MS = 2600;
/** "O'tkazib yuborish" bosilganda qisqa fade-out. */
export const SPLASH_SKIP_FADE_MS = 160;

export const isSplashDismissKey = (key: string) => key === "Escape" || key === "Enter";

/**
 * <head> dagi inline skript: birinchi paintdan oldin `<html data-splash="show|skip">` qo'yadi.
 * "show" faqat: bosh sahifaga (`/uz`, `/ru`…) to'g'ridan-to'g'ri kirilganda, reduced-motion yoqilmagan va
 * bu sessiyada splash hali ko'rsatilmagan bo'lsa. Storage ishlamasa (xato tashlasa) — "skip".
 */
export const SPLASH_INIT_SCRIPT = `(function(){var m="skip";try{var h=/^\\/(?:${locales.join(
  "|",
)})\\/?$/.test(location.pathname);if(h&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&!sessionStorage.getItem(${JSON.stringify(
  SPLASH_STORAGE_KEY,
)}))m="show"}catch(e){}document.documentElement.dataset.splash=m})();`;
