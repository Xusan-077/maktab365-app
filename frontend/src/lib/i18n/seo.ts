import type { Metadata } from "next";
import { defaultLocale, locales, type Locale } from "./config";

export const DEFAULT_SITE_URL = "https://www.darslik365.uz";

/** Saytning ochiq manzili (sitemap, robots, canonical, JSON-LD): env yoki prod domeni, oxirgi `/` siz. */
export function resolveSiteUrl(value: string | undefined): string {
  return (value?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

/** `NEXT_PUBLIC_*` build vaqtida kodga yoziladi: env o'zgarsa qayta deploy kerak. */
export const SITE_URL = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

/** `pathname` — tilsiz yo'l ("/" yoki "/darsliklar"). */
function localizedPath(locale: Locale, pathname: string): string {
  return pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
}

/** canonical + hreflang (barcha tillar va x-default) — sahifaning generateMetadata'sida ishlatiladi. */
export function getAlternates(
  locale: Locale,
  pathname: string,
): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = Object.fromEntries(
    locales.map((l) => [l, localizedPath(l, pathname)]),
  );
  languages["x-default"] = localizedPath(defaultLocale, pathname);
  return { canonical: localizedPath(locale, pathname), languages };
}

/** Sahifa `openGraph` ni o'zi belgilasa, `opengraph-image` fayli avtomatik qo'shilmaydi — shu rasm qo'lda beriladi. */
export const OG_IMAGES = [{ url: "/opengraph-image.png", width: 1200, height: 630 }];
