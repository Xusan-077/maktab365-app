import type { components } from "@/lib/api/schema";

type Me = components["schemas"]["Me"];

/** Backend JWT juftligi; faqat shifrlangan Auth.js cookie'sida (serverda) saqlanadi. */
export interface BackendTokens {
  access: string;
  refresh: string;
  /** Access tugash vaqti (ms, epoch) — `exp` claim'dan. */
  accessExpires: number;
}

/** Panel uchun rol: editor/admin o'qituvchi paneli bilan ishlaydi (`mappers.toUser` bilan bir xil). */
export type PanelRole = "student" | "teacher";

/** Sessiyadagi akkaunt holati: proxy yo'naltirishlari va banner shunga tayanadi. */
export interface AccountState {
  role: PanelRole;
  onboarded: boolean;
  emailVerified: boolean;
}

/** JWT payload'idan `exp` (imzo tekshirilmaydi — tokenni backend tekshiradi). */
export function jwtExpiresAt(token: string): number {
  const payload = token.split(".")[1];
  if (!payload) return 0;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: unknown;
    };
    return typeof json.exp === "number" ? json.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function toBackendTokens(pair: { access: string; refresh: string }): BackendTokens {
  return { access: pair.access, refresh: pair.refresh, accessExpires: jwtExpiresAt(pair.access) };
}

export function toAccountState(me: Me): AccountState {
  return {
    role: me.role === "student" ? "student" : "teacher",
    onboarded: Boolean(me.profile.onboarded_at),
    emailVerified: me.email_verified,
  };
}

/** Sessiyadagi ism: profil ismi yoki `null` (UI unda email ko'rsatadi; onboarding bo'sh maydon). */
export const displayNameOf = (me: Me) => me.profile.display_name || null;
