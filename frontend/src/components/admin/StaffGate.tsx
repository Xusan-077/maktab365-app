import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { fetchStaffIdentity } from "@/lib/admin/server";
import { AdminRoleProvider } from "./AdminRoleProvider";

/**
 * Server tomondagi qo'riqchi (proxy sessiya bo'yicha oldindan yopadi, bu esa backend `/me/` bo'yicha
 * yangi rolni tekshiradi): editor/admin bo'lmasa 404. Backend har bir admin so'rovini baribir o'zi tekshiradi.
 */
export async function StaffGate({ children }: { children: ReactNode }) {
  const identity = await fetchStaffIdentity();
  if (!identity) notFound();
  return <AdminRoleProvider identity={identity}>{children}</AdminRoleProvider>;
}
