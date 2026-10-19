import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
import { authConfig } from "@/auth.config";
import { defaultLocale, isLocale, locales } from "@/lib/i18n/config";
import { routing } from "@/lib/i18n/routing";
import { isUserRole, ROLE_COOKIE_NAME } from "@/lib/utils/role-cookie";
import { appBaseOfPath, dashboardPath, PROTECTED_ROUTES, ROUTES } from "@/lib/utils/routes";

const intlMiddleware = createMiddleware(routing);
const { auth } = NextAuth(authConfig);

const PROTECTED_PATH = new RegExp(
  `^(?:/(?:${locales.join("|")}))?(?:${PROTECTED_ROUTES.join("|")})(?:/|$)`,
);

const LOCALE_PREFIX = new RegExp(`^/(?:${locales.join("|")})(?=/|$)`);

// Faqat himoyalangan yo'llar sessiya talab qiladi; qolgan hamma narsa faqat til yo'naltirishidan o'tadi.
export default auth((request) => {
  const { pathname, search, origin } = request.nextUrl;
  if (PROTECTED_PATH.test(pathname) && !request.auth) {
    const first = pathname.split("/")[1];
    const locale = isLocale(first) ? first : defaultLocale;
    const loginUrl = new URL(`/${locale}${ROUTES.login}`, origin);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // O'quvchi /ustoz ga kirsa /kabinet ga, o'qituvchi /kabinet ga kirsa /ustoz ga qaytariladi. Rol cookie'si
  // ishora xolos (RoleCookieSync yozadi); haqiqiy tekshiruvni AccountGate profil bo'yicha qiladi.
  const role = request.cookies.get(ROLE_COOKIE_NAME)?.value;
  if (request.auth && isUserRole(role)) {
    const panel = appBaseOfPath(pathname.replace(LOCALE_PREFIX, "") || "/");
    const home = dashboardPath(role);
    if (panel && appBaseOfPath(home) !== panel) {
      const first = pathname.split("/")[1];
      const locale = isLocale(first) ? first : defaultLocale;
      return NextResponse.redirect(new URL(`/${locale}${home}`, origin));
    }
  }
  return intlMiddleware(request);
});

export const config = {
  // API, Next.js ichki yo'llari va fayllar (nuqtali yo'llar) tilga bog'lanmaydi
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
