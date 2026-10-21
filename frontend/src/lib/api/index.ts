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

/**
 * O'qish jarayoni (M8): progress, xatcho'p, reja, oxirgi ko'rilganlar, dashboard/natijalar va
 * mehmon ma'lumotini qo'shish. `http` rejimida haqiqiy backend (`/api/v1/me/...`).
 */
export const LEARNING_METHODS = [
  "getProgress",
  "saveProgress",
  "recordTopicOpened",
  "getRecent",
  "getDashboard",
  "getResults",
  "getTeacherDashboard",
  "mergeGuestData",
  "getBookmarks",
  "toggleBookmark",
  "setBookmark",
  "getBookBookmarks",
  "toggleBookBookmark",
  "getGoals",
  "createGoal",
  "updateGoal",
  "deleteGoal",
] as const satisfies readonly (keyof MaktabApi)[];

/** Katalog (fan, kitob, bob, mavzu, qidiruv) metodlari: backend `/api/v1` ochiq kontent API'si. */
export const CATALOG_METHODS = [
  "getGrades",
  "getSubjects",
  "getBooks",
  "getBook",
  "getChapters",
  "getTopic",
  "searchTopics",
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

/** Akkaunt metodlari `account` dan, qolganlari (katalog, progress…) `base` dan. */
export const withAccountApi = (base: MaktabApi, account: MaktabApi): MaktabApi =>
  withMethods(base, account, ACCOUNT_METHODS);

let instance: MaktabApi | undefined;

/**
 * `NEXT_PUBLIC_API_MODE=mock|http` bo'yicha tanlangan klient (default: mock).
 * - `mock`: hammasi mock, lekin akkaunt metodlari haqiqiy backend'ga boradi (sessiya backend tokenlari bilan).
 * - `http`: katalog (`CATALOG_METHODS`), akkaunt, o'qish jarayoni (`LEARNING_METHODS`) va health —
 *   hammasi backend.
 */
export function getApi(): MaktabApi {
  if (instance) return instance;
  const mock = new MockApi({ latencyMs: process.env.NODE_ENV === "development" ? 200 : 0 });
  if (API_MODE === "http") {
    instance = withMethods(mock, new HttpApi(), [
      "health",
      ...CATALOG_METHODS,
      ...ACCOUNT_METHODS,
      ...LEARNING_METHODS,
    ]);
  } else {
    instance = withAccountApi(mock, new HttpApi());
  }
  return instance;
}

export { ApiError, type HealthStatus, type MaktabApi } from "./types";
