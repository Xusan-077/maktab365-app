import type { StaffRole } from "@/lib/auth/tokens";
import type { TopicStatus } from "./types";

export type TransitionAction = "review" | "publish" | "unpublish";

interface Rule {
  from: TopicStatus;
  to: TopicStatus;
  action: TransitionAction;
  roles: readonly StaffRole[];
}

/** Backend `admin_services.TRANSITIONS` bilan bir xil (server baribir tekshiradi). */
const RULES: readonly Rule[] = [
  { from: "draft", to: "reviewed", action: "review", roles: ["editor", "admin"] },
  { from: "reviewed", to: "published", action: "publish", roles: ["editor", "admin"] },
  { from: "published", to: "draft", action: "unpublish", roles: ["admin"] },
];

export function transitionsFor(
  role: StaffRole,
  status: TopicStatus,
): { to: TopicStatus; action: TransitionAction }[] {
  return RULES.filter((rule) => rule.from === status && rule.roles.includes(role)).map(
    ({ to, action }) => ({ to, action }),
  );
}

/** O'chirish — faqat admin. */
export const canDelete = (role: StaffRole) => role === "admin";

/** Foydalanuvchilar bo'limi — faqat admin. */
export const canSeeUsers = (role: StaffRole) => role === "admin";
