import { headers } from "next/headers";
import { getToken, type JWT } from "next-auth/jwt";
import { rotatedTokens } from "./refresh";

/** Access shuncha oldin "eskirgan" deb hisoblanadi (backendgacha yo'l + soat farqi). */
const ACCESS_SKEW_MS = 10_000;

/** Auth.js cookie'sidan JWT'ni o'qiydi (faqat dekodlaydi — callback ishlamaydi, token almashmaydi). */
export async function readSessionToken(source: Headers): Promise<JWT | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  // https'da cookie nomi `__Secure-` prefiksli; ikkalasini ham sinaymiz.
  for (const secureCookie of [true, false]) {
    const token = await getToken({ req: { headers: source }, secret, secureCookie });
    if (token) return token;
  }
  return null;
}

/**
 * Hozir ishlatsa bo'ladigan backend juftligi: shu jarayonda yaqinda almashtirilgan bo'lsa yangisi
 * (cookie hali eski bo'lishi mumkin), aks holda cookie'dagisi — access muddati o'tmagan bo'lsa.
 */
export function effectiveTokens(
  token: JWT | null,
  now: number = Date.now(),
): { access: string; refresh: string } | null {
  const backend = token?.backend;
  if (!backend) return null;
  const rotated = rotatedTokens(backend.refresh, now);
  if (rotated) return rotated;
  return backend.accessExpires - ACCESS_SKEW_MS > now ? backend : null;
}

/**
 * Server (RSC, route handler) so'rovlari uchun Bearer token. Refresh qilmaydi: RSC'da Auth.js
 * yangilangan cookie'ni saqlay olmaydi, rotation esa eski refresh'ni bekor qiladi.
 * Yangilashni proxy, `/api/auth/session` va BFF (`auth()` o'ralgan route'lar) bajaradi.
 */
export async function getServerAccessToken(): Promise<string | null> {
  return effectiveTokens(await readSessionToken(await headers()))?.access ?? null;
}
