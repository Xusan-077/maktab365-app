import { getServerAccessToken } from "@/lib/auth/server-token";
import { HttpApi } from "./http-api";
import { createHttpClient } from "./http-client";

let instance: HttpApi | undefined;

/**
 * Kirgan foydalanuvchi nomidan server so'rovlari (RSC, server action): har so'rovga sessiyadagi
 * Bearer qo'shiladi. `headers()` ishlatgani uchun sahifani dinamik qiladi — ochiq katalog
 * ma'lumoti uchun `getApi()` (tokensiz) ishlating.
 */
export function getServerApi(): HttpApi {
  instance ??= new HttpApi(createHttpClient({ getAccessToken: getServerAccessToken }));
  return instance;
}
