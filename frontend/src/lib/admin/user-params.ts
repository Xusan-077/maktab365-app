import type { UserListParams, UserRole, UserStatus } from "./types";

type Raw = { get(name: string): string | null };

export const USER_ROLES: readonly UserRole[] = ["student", "teacher", "editor", "admin"];
export const USER_STATUSES: readonly UserStatus[] = ["active", "blocked"];

function positiveInt(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n >= 1 ? n : undefined;
}

/** URL search params → foydalanuvchilar ro'yxati so'rovi (noto'g'ri qiymatlar tashlab yuboriladi). */
export function parseUserParams(params: Raw): UserListParams {
  const role = params.get("role");
  const status = params.get("status");
  return {
    page: positiveInt(params.get("page")),
    search: params.get("q")?.trim() || undefined,
    role: USER_ROLES.find((r) => r === role),
    status: USER_STATUSES.find((s) => s === status),
  };
}

/** So'rov → URL query (bo'sh qiymatlar yo'q; 1-sahifa yozilmaydi). */
export function serializeUserParams(params: UserListParams): string {
  const query = new URLSearchParams();
  if (params.search) query.set("q", params.search);
  if (params.role) query.set("role", params.role);
  if (params.status) query.set("status", params.status);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  return query.toString();
}

/** Filtr o'zgarganda sahifa 1 ga qaytadi. */
export function withUserFilter(
  params: UserListParams,
  patch: Partial<UserListParams>,
): UserListParams {
  return { ...params, ...patch, page: patch.page };
}
