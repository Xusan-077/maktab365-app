import { ApiError } from "@/lib/api/types";
import { clientInfoFrom, startTelegramLogin, telegramLoginStatus } from "./backend";
import { errorResponse, isSameOrigin } from "./request-guards";

/**
 * Telegram bot orqali kirish (deep-link) — Next server tomoni. Brauzer `/api/auth/telegram/*` ga
 * boradi; backend bergan `nonce` shu sayt domenidagi httpOnly `tg_nonce` cookie'siga yoziladi
 * (backend boshqa domenda: uning cookie'si brauzerda uchinchi tomon cookie'si bo'lib qolardi).
 * Holat so'rovi va `signIn("telegram-bot")` nonce'ni cookie'dan olib backend'ga sarlavhada beradi —
 * havolani ko'rgan begona brauzer sessiyani ololmaydi.
 */

export const TELEGRAM_NONCE_COOKIE = "tg_nonce";
/** Holat route'i va Auth.js callback'i (`/api/auth/callback/telegram-bot`) shu yo'l ostida. */
const NONCE_COOKIE_PATH = "/api/auth";

export function readCookie(headers: Headers, name: string): string {
  for (const part of (headers.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

function nonceCookie(value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${TELEGRAM_NONCE_COOKIE}=${encodeURIComponent(value)}; Path=${NONCE_COOKIE_PATH}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export const clearNonceCookie = () => nonceCookie("", 0);

function backendErrorResponse(error: unknown): Response {
  if (error instanceof ApiError && error.status > 0) {
    return Response.json(
      { code: error.code, message: error.message, details: error.details },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return errorResponse(502, "network_error", "Backend is unreachable.");
}

/** `POST /api/auth/telegram/start` → `{token, bot_url, expires_in}` + `tg_nonce` cookie. */
export async function handleTelegramStart(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return errorResponse(403, "csrf_failed", "Cross-site request.");
  try {
    const { nonce, ...link } = await startTelegramLogin(clientInfoFrom(request.headers));
    const headers = new Headers({ "Cache-Control": "no-store" });
    headers.append("Set-Cookie", nonceCookie(nonce, link.expires_in));
    return Response.json(link, { headers });
  } catch (error) {
    return backendErrorResponse(error);
  }
}

/** `GET /api/auth/telegram/status?token=` → `{status}` (`tg_nonce` mos kelmasa backend 403 beradi). */
export async function handleTelegramStatus(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  try {
    const result = await telegramLoginStatus(
      token,
      readCookie(request.headers, TELEGRAM_NONCE_COOKIE),
      clientInfoFrom(request.headers),
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return backendErrorResponse(error);
  }
}
