import { BookOpen, LayoutDashboard, Users, type LucideIcon } from "lucide-react";
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
    href: ADMIN_ROUTES.books,
    icon: BookOpen,
    // Mavzu tahrirlash sahifalari ham "Kitoblar" bo'limiga kiradi.
    isActive: (pathname) =>
      within(ADMIN_ROUTES.books)(pathname) || within(`${ADMIN_ROUTES.home}/mavzular`)(pathname),
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
