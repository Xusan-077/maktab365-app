import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { fetchStaffIdentity } from "@/lib/admin/server";

/** Faqat admin uchun sahifa (masalan, foydalanuvchilar): editor uchun 404. Backend baribir 403 beradi. */
export async function AdminOnly({ children }: { children: ReactNode }) {
  const identity = await fetchStaffIdentity();
  if (identity?.role !== "admin") notFound();
  return children;
}
