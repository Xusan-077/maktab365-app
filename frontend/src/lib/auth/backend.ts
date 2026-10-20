import { createHttpClient, unwrap } from "@/lib/api/http-client";
import type { components } from "@/lib/api/schema";
import { ApiError } from "@/lib/api/types";
import { toBackendTokens, type BackendTokens } from "./tokens";

/**
 * Next serveridan backend `/api/v1/auth/*` ga so'rovlar (Auth.js callback'lari va BFF uchun).
 * Brauzer bu modulni chaqirmaydi: tokenlar faqat serverda.
 */

type AuthSession = components["schemas"]["AuthSession"];
type Me = components["schemas"]["Me"];

/** Mijoz IP va brauzeri — backend throttle/audit Next serverining IP'sini emas, foydalanuvchinikini ko'rsin. */
export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

export function clientInfoFrom(headers: Headers): ClientInfo {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip");
  return { ip: ip || undefined, userAgent: headers.get("user-agent") ?? undefined };
}

function forwardHeaders(info: ClientInfo = {}): Record<string, string> {
  return {
    ...(info.ip && { "X-Forwarded-For": info.ip }),
    ...(info.userAgent && { "User-Agent": info.userAgent }),
  };
}

const bearer = (access: string) => ({ Authorization: `Bearer ${access}` });

let client: ReturnType<typeof createHttpClient> | undefined;
const backend = () => (client ??= createHttpClient());

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  displayName?: string;
  locale?: components["schemas"]["LocaleEnum"];
}

export async function loginWithPassword(input: LoginInput, info?: ClientInfo) {
  const result = await backend().POST("/api/v1/auth/login/", {
    body: { email: input.email, password: input.password },
    headers: forwardHeaders(info),
  });
  return unwrap(result) satisfies AuthSession;
}

export async function registerWithPassword(input: RegisterInput, info?: ClientInfo) {
  const result = await backend().POST("/api/v1/auth/register/", {
    body: {
      email: input.email,
      password: input.password,
      ...(input.displayName && { display_name: input.displayName }),
      ...(input.locale && { locale: input.locale }),
    },
    headers: forwardHeaders(info),
  });
  return unwrap(result) satisfies AuthSession;
}

/**
 * `invalid` — refresh yaroqsiz/bekor qilingan (sessiya tugashi kerak);
 * `unavailable` — backend javob bermadi (sessiya saqlanadi, keyinroq qayta urinadi).
 */
export type RefreshResult =
  { ok: true; tokens: BackendTokens } | { ok: false; reason: "invalid" | "unavailable" };

export async function refreshBackendTokens(refresh: string): Promise<RefreshResult> {
  try {
    const result = await backend().POST("/api/v1/auth/refresh/", { body: { refresh } });
    return { ok: true, tokens: toBackendTokens(unwrap(result)) };
  } catch (error) {
    const invalid = error instanceof ApiError && error.status >= 400 && error.status < 500;
    // 429 — vaqtinchalik: token hali yaroqli bo'lishi mumkin.
    return { ok: false, reason: invalid && error.status !== 429 ? "invalid" : "unavailable" };
  }
}

/** Refresh'ni bekor qiladi; xato bo'lsa ham chiqish to'xtamaydi. */
export async function logoutBackend(refresh: string): Promise<void> {
  try {
    await backend().POST("/api/v1/auth/logout/", { body: { refresh } });
  } catch {
    // Backend o'chiq bo'lsa ham foydalanuvchi chiqadi; refresh o'z muddatida tugaydi.
  }
}

export async function fetchMe(access: string): Promise<Me | null> {
  try {
    return unwrap(await backend().GET("/api/v1/me/", { headers: bearer(access) }));
  } catch {
    return null;
  }
}

export interface PasswordChangeInput {
  current_password: string;
  new_password: string;
}

export async function changePasswordKeepingSession(
  tokens: { access: string; refresh: string },
  input: PasswordChangeInput,
  info?: ClientInfo,
) {
  const result = await backend().POST("/api/v1/auth/password/change/", {
    body: { ...input, refresh: tokens.refresh },
    headers: { ...bearer(tokens.access), ...forwardHeaders(info) },
  });
  return unwrap(result);
}
