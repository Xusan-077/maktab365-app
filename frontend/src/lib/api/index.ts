import { MockApi } from "@/mocks/mock-api";
import { BACKEND_AUTH } from "@/lib/auth/config";
import { HttpApi } from "./http-api";
import type { ApiMode, MaktabApi } from "./types";

export const API_MODE: ApiMode = process.env.NEXT_PUBLIC_API_MODE === "http" ? "http" : "mock";

/** Akkaunt (profil, onboarding, rol, o'chirish, eksport) va murojaat (support) metodlari. */
export const ACCOUNT_METHODS = [
  "getMe",
  "saveProfile",
  "updateProfile",
  "setRole",
  "deleteAccount",
  "exportData",
  "sendSupport",
  "getMySupport",
] as const satisfies readonly (keyof MaktabApi)[];

const ACCOUNT_METHOD_SET = new Set<PropertyKey>(ACCOUNT_METHODS);

/** Akkaunt metodlari `account` dan, qolganlari (katalog, progress…) `base` dan. */
export function withAccountApi(base: MaktabApi, account: MaktabApi): MaktabApi {
  return new Proxy(base, {
    get(target, prop) {
      const source = ACCOUNT_METHOD_SET.has(prop) ? account : target;
      const value: unknown = Reflect.get(source, prop);
      return typeof value === "function" ? value.bind(source) : value;
    },
  });
}

let instance: MaktabApi | undefined;

/**
 * `NEXT_PUBLIC_API_MODE=mock|http` bo'yicha tanlangan klient (default: mock).
 * `NEXT_PUBLIC_BACKEND_AUTH=true` bo'lsa akkaunt metodlari mock rejimida ham haqiqiy backend'ga
 * boradi (sessiya backend tokenlari bilan); katalog backend'i tayyor bo'lguncha mock'da qoladi.
 */
export function getApi(): MaktabApi {
  if (instance) return instance;
  if (API_MODE === "http") {
    instance = new HttpApi();
  } else {
    const mock = new MockApi({ latencyMs: process.env.NODE_ENV === "development" ? 200 : 0 });
    instance = BACKEND_AUTH ? withAccountApi(mock, new HttpApi()) : mock;
  }
  return instance;
}

export { ApiError, type HealthStatus, type MaktabApi } from "./types";
