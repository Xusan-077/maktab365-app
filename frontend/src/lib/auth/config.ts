/**
 * Auth.js provayder id'lari (`signIn(id, …)`). Hammasi backend JWT juftligini beradi: `password`,
 * `telegram` va `otp` — Credentials; `google` — OAuth, id_token `signIn` callback'ida backend'ga
 * almashtiriladi (Google'ning o'z sessiyasi ishlatilmaydi).
 */
export const PASSWORD_PROVIDER = "password";
export const GOOGLE_PROVIDER = "google";
export const TELEGRAM_PROVIDER = "telegram";
export const OTP_PROVIDER = "otp";

/** Telegram Login Widget boti (`@BotFather`, domen `/setdomain` bilan bog'langan). Bo'sh — tugma yashirin. */
export const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";

/**
 * Telegram boti raqamli id'si (bot tokenining `:` gacha qismi, maxfiy emas). Berilsa, maxsus
 * "Telegram bilan davom etish" tugmasi `Telegram.Login.auth` orqali ishlaydi; bo'sh bo'lsa va
 * `TELEGRAM_BOT_USERNAME` bor bo'lsa, rasmiy vidjet chiziladi.
 */
export const TELEGRAM_BOT_ID = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID ?? "";

/** Brauzerdagi API so'rovlari shu yerdan backend'ga o'tadi (tokenlar brauzerga chiqmaydi). */
export const BFF_PREFIX = "/api/backend";

/** Access muddati tugashiga shuncha qolganda oldindan yangilanadi. */
export const REFRESH_MARGIN_MS = 2 * 60 * 1000;
