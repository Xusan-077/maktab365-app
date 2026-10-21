import { cache } from "react";
import { connection } from "next/server";
import { createHttpClient } from "@/lib/api/http-client";
import { ApiError } from "@/lib/api/types";
import { getServerAccessToken } from "@/lib/auth/server-token";
import { staffRoleOf, type StaffRole } from "@/lib/auth/tokens";

export interface StaffIdentity {
  role: StaffRole;
  email: string | null;
}

/**
 * Admin sahifalari uchun server tomondagi rol tekshiruvi: rol sessiyadan emas, backend `/me/` dan
 * (yangi) o'qiladi; bir so'rovda takror chaqirilsa bitta backend so'rovi (`cache`).
 * Staff bo'lmasa yoki token yaroqsiz bo'lsa `null`; backend ishlamasa xato ko'tariladi.
 */
export const fetchStaffIdentity = cache(async (): Promise<StaffIdentity | null> => {
  // Har so'rovda yangi o'qiladi: prerender'da `crypto`/token ishlatilmasin (Cache Components).
  await connection();
  const client = createHttpClient({ getAccessToken: getServerAccessToken });
  const { data, response } = await client.GET("/api/v1/me/");
  if (!data) {
    if (response.status === 401 || response.status === 403) return null;
    throw new ApiError("Backend javobi kutilmagan", response.status, {
      code: "unexpected_response",
    });
  }
  const role = staffRoleOf(data.role);
  return role ? { role, email: data.email ?? null } : null;
});
