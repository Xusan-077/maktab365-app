import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { auth } from "@/auth";
import { resolveAuthRedirect } from "@/lib/auth/redirects";
import { isAdminDenied } from "@/lib/auth/staff";
import { defaultLocale, isLocale, locales } from "@/lib/i18n/config";
import { routing } from "@/lib/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const LOCALE_PREFIX = new RegExp(`^/(?:${locales.join("|")})(?=/|$)`);

/**
 * Sessiyaga qarab yo'naltirish (`resolveAuthRedirect`), qolgani — faqat til yo'naltirishi.
 * `auth()` o'rami access muddati yaqinlashganda backend tokenlarini yangilaydi va cookie'ni yozadi.
 * Haqiqiy tekshiruv `AccountGate` da.
 */
export default auth((request) => {
  const { pathname, search, origin } = request.nextUrl;
  const first = pathname.split("/")[1];
  const locale = isLocale(first) ? first : defaultLocale;
  const target = resolveAuthRedirect({
    path: pathname.replace(LOCALE_PREFIX, "") || "/",
    returnTo: `${pathname}${search}`,
    session: request.auth,
  });
  if (target) return NextResponse.redirect(new URL(`/${locale}${target}`, origin));
  // Staff bo'lmaganlar uchun /admin mavjud emasdek: noma'lum yo'lga rewrite → 404 holati.
  const path = pathname.replace(LOCALE_PREFIX, "") || "/";
  if (isAdminDenied(path, request.auth?.user?.staff)) {
    return NextResponse.rewrite(new URL(`/${locale}/not-found-admin`, origin));
  }
  return intlMiddleware(request);
});

export const config = {
  // API, Next.js ichki yo'llari va fayllar (nuqtali yo'llar) tilga bog'lanmaydi
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
