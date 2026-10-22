import {
  Bookmark,
  BookOpen,
  ChartColumn,
  FileText,
  GraduationCap,
  House,
  type LucideIcon,
} from "lucide-react";
import { ROUTES, type PanelBase } from "@/lib/utils/routes";

export interface AppNavItem {
  /** To'liq i18n kaliti. */
  labelKey: string;
  href: string;
  icon: LucideIcon;
  /** Pathname (til prefiksisiz) shu bo'limga tegishlimi. */
  isActive: (pathname: string) => boolean;
}

const exact = (href: string) => (pathname: string) => pathname === href;
const within = (href: string) => (pathname: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** "Darsliklar" ochiq katalogga olib boradi (panel qobig'idan tashqarida), shuning uchun faol emas. */
const textbooks = (labelKey: string): AppNavItem => ({
  labelKey,
  href: ROUTES.textbooks,
  icon: FileText,
  isActive: () => false,
});

/** O'quvchi: Bosh sahifa · Darsliklar · Fanlarim · Natijalar · Saqlanganlar. */
const STUDENT_NAV: AppNavItem[] = [
  {
    labelKey: "cabinet.nav.home",
    href: ROUTES.cabinet,
    icon: House,
    isActive: exact(ROUTES.cabinet),
  },
  textbooks("cabinet.nav.textbooks"),
  {
    labelKey: "cabinet.nav.subjects",
    href: ROUTES.cabinetSubjects,
    icon: GraduationCap,
    isActive: within(ROUTES.cabinetSubjects),
  },
  {
    labelKey: "cabinet.nav.results",
    href: ROUTES.cabinetResults,
    icon: ChartColumn,
    isActive: within(ROUTES.cabinetResults),
  },
  {
    labelKey: "cabinet.nav.saved",
    href: ROUTES.cabinetSaved,
    icon: Bookmark,
    isActive: within(ROUTES.cabinetSaved),
  },
];

/** O'qituvchi: Bosh sahifa · Darsliklar · Saqlanganlar. */
const TEACHER_NAV: AppNavItem[] = [
  {
    labelKey: "teacher.nav.home",
    href: ROUTES.teacher,
    icon: BookOpen,
    isActive: exact(ROUTES.teacher),
  },
  textbooks("teacher.nav.textbooks"),
  {
    labelKey: "teacher.nav.saved",
    href: ROUTES.teacherSaved,
    icon: Bookmark,
    isActive: within(ROUTES.teacherSaved),
  },
];

export const appNavFor = (base: PanelBase) => (base === "ustoz" ? TEACHER_NAV : STUDENT_NAV);
