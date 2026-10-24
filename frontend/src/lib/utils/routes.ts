export const ROUTES = {
  home: "/",
  textbooks: "/darsliklar",
  subjects: "/fanlar",
  about: "/loyiha-haqida",
  login: "/kirish",
  register: "/royxatdan-otish",
  otp: "/kod",
  forgotPassword: "/parolni-unutdim",
  resetPassword: "/parolni-tiklash",
  verifyEmail: "/email-tasdiqlash",
  onboarding: "/onboarding",
  cabinet: "/kabinet",
  cabinetSaved: "/kabinet/saqlanganlar",
  cabinetResults: "/kabinet/natijalar",
  cabinetSubjects: "/kabinet/fanlar",
  cabinetHelp: "/kabinet/yordam",
  teacher: "/ustoz",
  teacherSaved: "/ustoz/saqlanganlar",
  teacherHelp: "/ustoz/yordam",
  settings: "/sozlamalar",
  admin: "/admin",
  search: "/qidiruv",
  help: "/yordam",
  contact: "/aloqa",
  terms: "/shartlar",
  privacy: "/maxfiylik",
  offline: "/oflayn",
} as const;

/** Faqat shu yo'llar (va ichkilari) sessiya talab qiladi; qolgan hamma sahifa ochiq. */
export const PROTECTED_ROUTES = [
  ROUTES.cabinet,
  ROUTES.teacher,
  ROUTES.settings,
  ROUTES.admin,
] as const;

/** Havolalar qaysi bazaga ketadi: ochiq sayt yoki shaxsiy panel (o'quvchi kabineti / ustoz paneli). */
export type AppBase = "marketing" | "kabinet" | "ustoz";
export type PanelBase = Exclude<AppBase, "marketing">;

const BASE_PREFIX: Record<AppBase, string> = {
  marketing: "",
  kabinet: ROUTES.cabinet,
  ustoz: ROUTES.teacher,
};

/** Pathname (til prefiksisiz) qaysi panelga tegishli; panel emas bo'lsa `null`. */
export function appBaseOfPath(pathname: string): PanelBase | null {
  for (const base of ["kabinet", "ustoz"] as const) {
    const prefix = BASE_PREFIX[base];
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return base;
  }
  return null;
}

export const roleBase = (role: "student" | "teacher"): PanelBase =>
  role === "teacher" ? "ustoz" : "kabinet";

/** Bazaning bosh sahifasi: marketing → `/`, panel → kabinet yoki ustoz bosh sahifasi. */
export const baseHome = (base: AppBase) => (base === "marketing" ? ROUTES.home : BASE_PREFIX[base]);

/** Darsliklar katalogi (sinf → fan → kitoblar): hamma uchun ochiq, panel ichida ham shu sahifa. */
export const catalogPath = () => ROUTES.textbooks;
/** Sinf bo'yicha katalog: `/darsliklar?sinf=9` (alohida sinf sahifasi yo'q). */
export const gradePath = (grade: number) => `${ROUTES.textbooks}?sinf=${grade}`;

/** Kitobning yo'l qismlari (API `PdfBook` ning ichki to'plami). */
export interface BookRef {
  grade: number;
  slug: string;
}

/** Kitob sahifasi: `/darsliklar/9/9-sinf-algebra`. */
export const pdfBookPath = (book: BookRef) => `${ROUTES.textbooks}/${book.grade}/${book.slug}`;

/** O'qish oynasi: `/darsliklar/9/9-sinf-algebra/oqish?page=N`. */
export const readerPath = (book: BookRef, page?: number) =>
  `${pdfBookPath(book)}/oqish${page && page > 1 ? `?page=${page}` : ""}`;

/** Panel ichidagi Yordam sahifasi (rolga mos). */
export const helpPath = (base: PanelBase) =>
  base === "kabinet" ? ROUTES.cabinetHelp : ROUTES.teacherHelp;

/** Kirgandan keyin rolga mos bosh sahifa: o'quvchi → kabinet, o'qituvchi → ustoz. */
export const dashboardPath = (role: "student" | "teacher") =>
  role === "teacher" ? ROUTES.teacher : ROUTES.cabinet;

/** `callbackUrl` faqat shu saytning ichki yo'li bo'lsin (open redirect'dan himoya). */
export function safeCallbackPath(value: string | null | undefined): string | undefined {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : undefined;
}
