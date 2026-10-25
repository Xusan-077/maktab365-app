import { ApiError } from "@/lib/api/types";

/**
 * Brauzer tomoni: Telegram bot orqali kirish (`/api/auth/telegram/*`, `lib/auth/telegram-bot.ts`).
 * Tokenlar bu yerga kelmaydi — tasdiqlangach `signIn("telegram-bot", { token })` sessiyani quradi.
 */

export interface TelegramLoginLink {
  token: string;
  bot_url: string;
  expires_in: number;
}

export type TelegramLoginStatus = "pending" | "confirmed" | "expired";

/** Holat shuncha oraliqda so'raladi (tab yashirin bo'lsa to'xtaydi). */
export const TELEGRAM_POLL_MS = 2000;

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(body?.message ?? response.statusText, response.status, {
      code: typeof body?.code === "string" ? body.code : "unknown",
    });
  }
  return body as T;
}

async function send<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, { ...init, credentials: "include", cache: "no-store" });
  } catch {
    throw new ApiError("Network error", 0, { code: "network_error" });
  }
  return parse<T>(response);
}

export const requestTelegramLogin = () =>
  send<TelegramLoginLink>("/api/auth/telegram/start", { method: "POST" });

export const fetchTelegramLoginStatus = async (token: string) =>
  (
    await send<{ status: TelegramLoginStatus }>(
      `/api/auth/telegram/status?${new URLSearchParams({ token })}`,
    )
  ).status;

/** `m:ss` — teskari sanoq. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
