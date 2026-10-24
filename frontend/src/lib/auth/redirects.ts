import { appBaseOfPath, dashboardPath, PROTECTED_ROUTES, ROUTES } from "@/lib/utils/routes";
import type { PanelRole, StaffRole } from "./tokens";

export interface RedirectSession {
  user?: { role?: PanelRole; staff?: StaffRole | null; onboarded?: boolean } | null;
}

export interface RedirectInput {
  /** Til prefiksisiz yo'l (`/kabinet/fanlar`). */
  path: string;
  /** Kirishdan keyin qaytish uchun to'liq yo'l (til prefiksi va query bilan). */
  returnTo: string;
  session: RedirectSession | null;
}

const isUnder = (path: string, route: string) => path === route || path.startsWith(`${route}/`);
const isProtected = (path: string) => PROTECTED_ROUTES.some((route) => isUnder(path, route));

/**
 * Proxy yo'naltirishi (til prefiksisiz natija yoki `null`):
 * - kirmagan: himoyalangan sahifa va onboarding → `/kirish?callbackUrl=…`;
 * - admin (`staff: "admin"`): ochiq sayt va `/admin` — yo'naltirilmaydi (saytni oddiy foydalanuvchidek
 *   ko'radi); o'quvchi/ustoz panellari, sozlamalar, kirish va onboarding → `/admin` (onboarding'siz);
 * - sessiya (`onboarded`/`role` sessiyada): onboarding tugamagan → `/onboarding`;
 *   tugagan → kirish/kod/onboarding sahifasidan va boshqa rol paneli → o'z paneli (`/kabinet` | `/ustoz`).
 */
export function resolveAuthRedirect({ path, returnTo, session }: RedirectInput): string | null {
  if (!session) {
    if (isProtected(path) || isUnder(path, ROUTES.onboarding)) {
      return `${ROUTES.login}?${new URLSearchParams({ callbackUrl: returnTo })}`;
    }
    return null;
  }

  const user = session.user;
  const onAuthPage =
    isUnder(path, ROUTES.login) || isUnder(path, ROUTES.register) || isUnder(path, ROUTES.otp);
  if (user?.staff === "admin") {
    if (isUnder(path, ROUTES.admin)) return null;
    const learnerOnly = isProtected(path) || onAuthPage || isUnder(path, ROUTES.onboarding);
    return learnerOnly ? ROUTES.admin : null;
  }
  if (typeof user?.onboarded !== "boolean" || !user.role) return null;
  if (!user.onboarded) {
    return isProtected(path) || onAuthPage ? ROUTES.onboarding : null;
  }
  const home = dashboardPath(user.role);
  if (isUnder(path, ROUTES.onboarding) || onAuthPage) return home;
  const panel = appBaseOfPath(path);
  return panel && appBaseOfPath(home) !== panel ? home : null;
}
