import { MockApi } from "@/mocks/mock-api";
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

/** `methods` ro'yxatidagi metodlar `overlay` dan, qolganlari `base` dan olinadi. */
export function withMethods(
  base: MaktabApi,
  overlay: MaktabApi,
  methods: readonly PropertyKey[],
): MaktabApi {
  const overlaid = new Set<PropertyKey>(methods);
  return new Proxy(base, {
    get(target, prop) {
      const source = overlaid.has(prop) ? overlay : target;
      const value: unknown = Reflect.get(source, prop);
      return typeof value === "function" ? value.bind(source) : value;
    },
  });
}

/** Akkaunt metodlari `account` dan, qolganlari `base` dan. */
export const withAccountApi = (base: MaktabApi, account: MaktabApi): MaktabApi =>
  withMethods(base, account, ACCOUNT_METHODS);

let instance: MaktabApi | undefined;

/**
 * `NEXT_PUBLIC_API_MODE=mock|http` bo'yicha tanlangan klient (default: mock).
 * - `mock`: akkaunt metodlari haqiqiy backend'ga boradi (sessiya backend tokenlari bilan), health mock.
 * - `http`: hammasi backend.
 */
export function getApi(): MaktabApi {
  if (instance) return instance;
  const mock = new MockApi({ latencyMs: process.env.NODE_ENV === "development" ? 200 : 0 });
  instance =
    API_MODE === "http"
      ? withMethods(mock, new HttpApi(), ["health", ...ACCOUNT_METHODS])
      : withAccountApi(mock, new HttpApi());
  return instance;
}

export { ApiError, type HealthStatus, type MaktabApi } from "./types";
