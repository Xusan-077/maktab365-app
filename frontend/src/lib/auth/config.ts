/**
 * Auth.js provayder id'lari (`signIn(id, …)`). Hammasi backend JWT juftligini beradi: `password`,
 * `telegram` va `otp` — Credentials; `google` — OAuth, id_token `signIn` callback'ida backend'ga
 * almashtiriladi (Google'ning o'z sessiyasi ishlatilmaydi).
 */
export const PASSWORD_PROVIDER = "password";
export const GOOGLE_PROVIDER = "google";
export const TELEGRAM_PROVIDER = "telegram";
export const OTP_PROVIDER = "otp";
/** Telegram bot orqali kirish (deep-link + polling); `telegram` — eski Login Widget (bog'lash uchun). */
export const TELEGRAM_BOT_PROVIDER = "telegram-bot";

/** Telegram Login Widget boti (faqat Sozlamalar → kirish usullarini bog'lash; domen `/setdomain`). */
export const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";

/** Brauzerdagi API so'rovlari shu yerdan backend'ga o'tadi (tokenlar brauzerga chiqmaydi). */
export const BFF_PREFIX = "/api/backend";

/** Access muddati tugashiga shuncha qolganda oldindan yangilanadi. */
export const REFRESH_MARGIN_MS = 2 * 60 * 1000;
