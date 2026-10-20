/**
 * `NEXT_PUBLIC_BACKEND_AUTH=true` — yangi oqim: email+parol (backend JWT), sessiyada rol/onboarding,
 * proxy yo'naltirishlari; akkaunt API'si doim haqiqiy backend (`getApi`). `false` — eski oqim
 * (faqat Google, rol cookie'si).
 */
export const BACKEND_AUTH = process.env.NEXT_PUBLIC_BACKEND_AUTH === "true";

/** Credentials provayderi id'si (`signIn("password", …)`). */
export const PASSWORD_PROVIDER = "password";

/** Brauzerdagi API so'rovlari shu yerdan backend'ga o'tadi (tokenlar brauzerga chiqmaydi). */
export const BFF_PREFIX = "/api/backend";

/** Access muddati tugashiga shuncha qolganda oldindan yangilanadi. */
export const REFRESH_MARGIN_MS = 2 * 60 * 1000;
