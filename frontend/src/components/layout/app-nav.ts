import {
  Bookmark,
  BookOpen,
  ChartColumn,
  House,
  Layers,
  Library,
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
const within =
  (...hrefs: string[]) =>
  (pathname: string) =>
    hrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));

/** O'quvchi: Bosh sahifa · Fanlarim · Darsliklar · Natijalar · Saqlanganlar. */
const STUDENT_NAV: AppNavItem[] = [
  {
    labelKey: "cabinet.nav.home",
    href: ROUTES.cabinet,
    icon: House,
    isActive: exact(ROUTES.cabinet),
  },
  {
    labelKey: "cabinet.nav.subjects",
    href: ROUTES.cabinetSubjects,
    icon: Library,
    isActive: within(ROUTES.cabinetSubjects),
  },
  {
    labelKey: "cabinet.nav.textbooks",
    href: `${ROUTES.cabinet}${ROUTES.textbooks}`,
    icon: BookOpen,
    isActive: within(`${ROUTES.cabinet}${ROUTES.textbooks}`),
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

/** O'qituvchi: Darsliklar · Mavzular · Saqlanganlar. Fan/kitob/mavzu sahifalari "Darsliklar" ostida. */
const TEACHER_NAV: AppNavItem[] = [
  {
    labelKey: "teacher.nav.books",
    href: ROUTES.teacher,
    icon: BookOpen,
    isActive: (pathname) =>
      pathname === ROUTES.teacher ||
      within(
        `${ROUTES.teacher}${ROUTES.textbooks}`,
        `${ROUTES.teacher}${ROUTES.subjects}`,
      )(pathname),
  },
  {
    labelKey: "teacher.nav.topics",
    href: ROUTES.teacherTopics,
    icon: Layers,
    isActive: within(ROUTES.teacherTopics),
  },
  {
    labelKey: "teacher.nav.saved",
    href: ROUTES.teacherSaved,
    icon: Bookmark,
    isActive: within(ROUTES.teacherSaved),
  },
];

export const appNavFor = (base: PanelBase) => (base === "ustoz" ? TEACHER_NAV : STUDENT_NAV);
