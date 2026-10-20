import type { User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { components } from "@/lib/api/schema";
import type { RefreshResult } from "./backend";
import { REFRESH_MARGIN_MS } from "./config";
import { displayNameOf, toAccountState } from "./tokens";

type Me = components["schemas"]["Me"];

export interface JwtDeps {
  now: () => number;
  refresh: (refresh: string) => Promise<RefreshResult>;
  fetchMe: (access: string) => Promise<Me | null>;
}

export interface JwtParams {
  token: JWT;
  user?: User | null;
  trigger?: "signIn" | "signUp" | "update";
}

/** Backend `Me` dan sessiya maydonlari (ism, email, rol, onboarding, email tasdig'i). */
export function accountClaims(me: Me): Pick<JWT, "name" | "email" | "account"> {
  return { name: displayNameOf(me), email: me.email, account: toAccountState(me) };
}

/**
 * Auth.js `jwt` callback'i (email+parol sessiyasi):
 * - kirishda backend tokenlari va akkaunt holati cookie'ga yoziladi;
 * - access tugashiga `REFRESH_MARGIN_MS` qolganda `/auth/refresh/` bilan yangilanadi;
 * - refresh rad etilsa: access hali amal qilsa sessiya qoladi, aks holda tugaydi (`null`);
 * - `update(data)` (onboarding, rol, email tasdig'i) va onboarding tugamaguncha har o'qishda —
 *   holat backend `/me/` dan qayta o'qiladi.
 * Google sessiyalari (backend tokeni yo'q) o'zgarishsiz o'tadi.
 */
export async function backendJwt(
  { token, user, trigger }: JwtParams,
  deps: JwtDeps,
): Promise<JWT | null> {
  if (user?.backend) {
    return {
      ...token,
      backend: user.backend,
      account: user.account,
      name: user.name,
      email: user.email,
      error: undefined,
    };
  }
  if (!token.backend) return token;

  let next: JWT = token;
  const now = deps.now();
  if (now >= token.backend.accessExpires - REFRESH_MARGIN_MS) {
    const result = await deps.refresh(token.backend.refresh);
    if (result.ok) {
      next = { ...token, backend: result.tokens, error: undefined };
    } else if (result.reason === "invalid") {
      if (now >= token.backend.accessExpires) return null;
      next = { ...token, error: "RefreshFailed" };
    }
    // `unavailable`: backend javob bermadi — sessiya o'zgarmaydi, keyingi so'rov qayta uradi.
  }

  // Onboarding paytida holat har o'qishda yangilanadi: klient `update()` o'tib ketsa ham proxy
  // keyingi navigatsiyada `onboarded=true` ni ko'radi (onboarding tugagach bu so'rov to'xtaydi).
  if ((trigger === "update" || next.account?.onboarded === false) && next.backend) {
    const me = await deps.fetchMe(next.backend.access);
    if (me) next = { ...next, ...accountClaims(me) };
  }
  return next;
}
