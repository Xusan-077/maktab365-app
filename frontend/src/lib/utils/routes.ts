export const ROUTES = {
  home: "/",
  textbooks: "/darsliklar",
  subjects: "/fanlar",
  about: "/loyiha-haqida",
  login: "/kirish",
  forgotPassword: "/parolni-unutdim",
  resetPassword: "/parolni-tiklash",
  verifyEmail: "/email-tasdiqlash",
  onboarding: "/onboarding",
  cabinet: "/kabinet",
  cabinetSubjects: "/kabinet/fanlar",
  cabinetResults: "/kabinet/natijalar",
  cabinetSaved: "/kabinet/saqlanganlar",
  cabinetHelp: "/kabinet/yordam",
  teacher: "/ustoz",
  teacherTopics: "/ustoz/mavzular",
  teacherSaved: "/ustoz/saqlanganlar",
  teacherHelp: "/ustoz/yordam",
  settings: "/sozlamalar",
  search: "/qidiruv",
  help: "/yordam",
  contact: "/aloqa",
} as const;

/** Faqat shu yo'llar (va ichkilari) sessiya talab qiladi; qolgan hamma sahifa ochiq. */
export const PROTECTED_ROUTES = [ROUTES.cabinet, ROUTES.teacher, ROUTES.settings] as const;

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

/** Katalog: marketing/kabinet `…/darsliklar`; ustozda katalog panelning bosh sahifasi. */
export const catalogPath = (base: AppBase = "marketing") =>
  base === "ustoz" ? ROUTES.teacher : `${BASE_PREFIX[base]}${ROUTES.textbooks}`;

/** Fanlar ro'yxati: marketing `/fanlar`, kabinet "Fanlarim", ustozda — katalog. */
export const subjectsPath = (base: AppBase = "marketing") =>
  base === "marketing"
    ? ROUTES.subjects
    : base === "kabinet"
      ? ROUTES.cabinetSubjects
      : ROUTES.teacher;

export const subjectPath = (slug: string, base: AppBase = "marketing") =>
  `${BASE_PREFIX[base]}${ROUTES.subjects}/${slug}`;
export const bookPath = (bookId: string, base: AppBase = "marketing") =>
  `${BASE_PREFIX[base]}${ROUTES.textbooks}/${bookId}`;
export const topicPath = (bookId: string, topicId: string, base: AppBase = "marketing") =>
  `${bookPath(bookId, base)}/${topicId}`;

/** Mavzu sahifasida oxirgi o'qilgan blokka olib boradigan havola (`ReadingTracker` hash'ni o'qiydi). */
export const topicBlockPath = (
  bookId: string,
  topicId: string,
  blockId: string,
  base: AppBase = "marketing",
) => `${topicPath(bookId, topicId, base)}#block-${encodeURIComponent(blockId)}`;

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

/**
 * Panel yo'lini (`/uz/ustoz/darsliklar/...`) ochiq sayt yo'liga aylantiradi (`/uz/darsliklar/...`):
 * ulashiladigan havola kirishni talab qilmasin. Panel bo'lmagan yo'l o'zgarmaydi.
 */
export function toPublicPath(pathname: string): string {
  return pathname.replace(/^((?:\/[A-Za-z-]+)?)\/(?:kabinet|ustoz)(?=\/)/, "$1");
}
