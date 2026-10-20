import { appBaseOfPath, dashboardPath, PROTECTED_ROUTES, ROUTES } from "@/lib/utils/routes";
import type { PanelRole } from "./tokens";

export interface RedirectSession {
  user?: { role?: PanelRole; onboarded?: boolean } | null;
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
  if (typeof user?.onboarded !== "boolean" || !user.role) return null;
  const onAuthPage = isUnder(path, ROUTES.login) || isUnder(path, ROUTES.otp);
  if (!user.onboarded) {
    return isProtected(path) || onAuthPage ? ROUTES.onboarding : null;
  }
  const home = dashboardPath(user.role);
  if (isUnder(path, ROUTES.onboarding) || onAuthPage) return home;
  const panel = appBaseOfPath(path);
  return panel && appBaseOfPath(home) !== panel ? home : null;
}
