import { ROUTES } from "@/lib/utils/routes";
import type { StaffRole } from "./tokens";

const isUnder = (path: string, route: string) => path === route || path.startsWith(`${route}/`);

export const isAdminPath = (path: string) => isUnder(path, ROUTES.admin);

/**
 * Proxy: `/admin` ga sessiyadagi rol bo'yicha kirish. Faqat sessiya **aniq** `staff: null` desa
 * yopiladi (404); `undefined` (eski cookie) o'tkaziladi — haqiqiy tekshiruv serverda, `/me/` bo'yicha
 * (`StaffGate`), backend esa har so'rovda rolni o'zi tekshiradi.
 */
export function isAdminDenied(path: string, staff: StaffRole | null | undefined): boolean {
  return isAdminPath(path) && staff === null;
}
