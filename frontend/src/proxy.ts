import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { auth } from "@/auth";
import { resolveAuthRedirect } from "@/lib/auth/redirects";
import { isAdminDenied } from "@/lib/auth/staff";
import { resolveBaseUrl } from "@/lib/api/http-client";
import { defaultLocale, isLocale, locales } from "@/lib/i18n/config";
import { routing } from "@/lib/i18n/routing";
import { legacyBookId, legacyBookTarget, legacyGradeRedirect } from "@/lib/pdf/legacy-redirect";

const intlMiddleware = createMiddleware(routing);

const LOCALE_PREFIX = new RegExp(`^/(?:${locales.join("|")})(?=/|$)`);

/** Eski `/darsliklar/<uuid>` uchun yangi o'qish manzili (kitob topilmasa yoki backend javob bermasa `null`). */
async function legacyBookRedirect(id: string, search: string): Promise<string | null> {
  try {
    const response = await fetch(`${resolveBaseUrl()}/api/v1/pdf-books/${id}/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const book = (await response.json()) as { grade: number; slug: string };
    return legacyBookTarget(book, search);
  } catch {
    return null;
  }
}

/**
 * Sessiyaga qarab yo'naltirish (`resolveAuthRedirect`), qolgani — faqat til yo'naltirishi.
 * `auth()` o'rami access muddati yaqinlashganda backend tokenlarini yangilaydi va cookie'ni yozadi.
 * Haqiqiy tekshiruv `AccountGate` da.
 */
export default auth(async (request) => {
  const { pathname, search, origin } = request.nextUrl;
  const first = pathname.split("/")[1];
  const locale = isLocale(first) ? first : defaultLocale;
  // Eski katalog va kitob havolalari yangi manzillarga doimiy (308) yo'naltiriladi.
  const bare = pathname.replace(LOCALE_PREFIX, "") || "/";
  const gradeTarget = legacyGradeRedirect(bare, search);
  if (gradeTarget) return NextResponse.redirect(new URL(`/${locale}${gradeTarget}`, origin), 308);
  const legacyId = legacyBookId(bare);
  if (legacyId) {
    const target = await legacyBookRedirect(legacyId, search);
    if (target) return NextResponse.redirect(new URL(`/${locale}${target}`, origin), 308);
  }
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
