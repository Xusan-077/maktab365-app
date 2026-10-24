import type { StaffRole } from "@/lib/auth/tokens";

/** O'chirish — faqat admin (server baribir tekshiradi). */
export const canDelete = (role: StaffRole) => role === "admin";

/** Nashr qilingan kitobni yashirish (published→draft) — faqat admin. */
export const canUnpublish = (role: StaffRole) => role === "admin";

/** Foydalanuvchilar bo'limi — faqat admin. */
export const canSeeUsers = (role: StaffRole) => role === "admin";
