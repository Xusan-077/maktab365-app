"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StaffIdentity } from "@/lib/admin/server";

const AdminRoleContext = createContext<StaffIdentity | null>(null);

/** Server `StaffGate` tekshirgan rol (editor/admin) mijoz komponentlariga shu orqali beriladi. */
export function AdminRoleProvider({
  identity,
  children,
}: {
  identity: StaffIdentity;
  children: ReactNode;
}) {
  return <AdminRoleContext.Provider value={identity}>{children}</AdminRoleContext.Provider>;
}

export function useAdminIdentity(): StaffIdentity {
  const identity = useContext(AdminRoleContext);
  if (!identity) throw new Error("useAdminIdentity AdminRoleProvider ichida ishlatilishi kerak");
  return identity;
}
