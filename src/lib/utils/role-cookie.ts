import type { UserRole } from "@/types/user";

/**
 * Profil roli haqida brauzer tomonidan qo'yiladigan ishora: `proxy.ts` shu orqali o'quvchini
 * `/ustoz`dan, o'qituvchini `/kabinet`dan sahifa yuklanmasdan qaytaradi. Xavfsizlik chegarasi emas —
 * haqiqiy tekshiruv `AccountGate` (profil) va API da.
 */
export const ROLE_COOKIE_NAME = "maktab365-role";
export const ROLE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const isUserRole = (value: unknown): value is UserRole =>
  value === "student" || value === "teacher";
