import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { auth } from "@/auth";
import { resolveAuthRedirect } from "@/lib/auth/redirects";
import { isAdminDenied } from "@/lib/auth/staff";
import { resolveBaseUrl } from "@/lib/api/http-client";
import { defaultLocale, isLocale, locales } from "@/lib/i18n/config";
import { routing } from "@/lib/i18n/routing";
import {
  bookPageRef,
  legacyBookId,
  legacyBookTarget,
  legacyGradeRedirect,
} from "@/lib/pdf/legacy-redirect";
import { GRADES } from "@/types/catalog";
import { pdfBookPath } from "@/lib/utils/routes";

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
 * Kitob sahifasi (`/darsliklar/<sinf>/<slug>`) uchun haqiqiy HTTP holati. Sahifa o'zi buni qila
 * olmaydi: slug oldindan noma'lum, kontent streaming bilan keladi va status allaqachon 200 bo'ladi
 * (soft 404). Shuning uchun shu yerda: yo'q kitob — 404 (rewrite), boshqa sinfdagi — 308.
 * Backend javob bermasa (tarmoq, 5xx) so'rov sahifaga o'tadi.
 */
async function bookPageCheck(
  ref: { grade: number; slug: string },
  locale: string,
  origin: string,
): Promise<NextResponse | null> {
  const notFoundResponse = () => NextResponse.rewrite(new URL(`/${locale}/not-found-book`, origin));
  if (!(GRADES as readonly number[]).includes(ref.grade)) return notFoundResponse();
  try {
    const response = await fetch(
      `${resolveBaseUrl()}/api/v1/pdf-books/by-slug/${encodeURIComponent(ref.slug)}/`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (response.status === 404) return notFoundResponse();
    if (!response.ok) return null;
    const book = (await response.json()) as { grade: number; slug: string };
    if (book.grade !== ref.grade) {
      return NextResponse.redirect(new URL(`/${locale}${pdfBookPath(book)}`, origin), 308);
    }
  } catch {
    // Backend javob bermadi: tekshiruvsiz davom etamiz (sahifa o'zi notFound() qiladi).
  }
  return null;
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
  const bookRef = bookPageRef(bare);
  if (bookRef) {
    const checked = await bookPageCheck(bookRef, locale, origin);
    if (checked) return checked;
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
