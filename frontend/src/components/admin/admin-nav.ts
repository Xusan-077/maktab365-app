import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Library,
  Users,
  type LucideIcon,
} from "lucide-react";
import { canSeeUsers } from "@/lib/admin/permissions";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import type { StaffRole } from "@/lib/auth/tokens";

export interface AdminNavItem {
  /** `admin.nav.*` kaliti. */
  key: string;
  href: string;
  icon: LucideIcon;
  /** Pathname (til prefiksisiz) shu bo'limga tegishlimi. */
  isActive: (pathname: string) => boolean;
  allowed: (role: StaffRole) => boolean;
}

const within = (href: string) => (pathname: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const ITEMS: AdminNavItem[] = [
  {
    key: "dashboard",
    href: ADMIN_ROUTES.home,
    icon: LayoutDashboard,
    isActive: (pathname) => pathname === ADMIN_ROUTES.home,
    allowed: () => true,
  },
  {
    key: "books",
    href: ADMIN_ROUTES.pdfBooks,
    icon: FileText,
    isActive: within(ADMIN_ROUTES.pdfBooks),
    allowed: () => true,
  },
  {
    key: "subjects",
    href: ADMIN_ROUTES.subjects,
    icon: Library,
    isActive: within(ADMIN_ROUTES.subjects),
    allowed: () => true,
  },
  {
    key: "stats",
    href: ADMIN_ROUTES.stats,
    icon: BarChart3,
    isActive: within(ADMIN_ROUTES.stats),
    allowed: () => true,
  },
  {
    key: "users",
    href: ADMIN_ROUTES.users,
    icon: Users,
    isActive: within(ADMIN_ROUTES.users),
    allowed: canSeeUsers,
  },
];

export const adminNavFor = (role: StaffRole) => ITEMS.filter((item) => item.allowed(role));
