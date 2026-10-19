import { defineRouting } from "next-intl/routing";
import { defaultLocale, LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME, locales } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  // hreflang'ni sahifa metadata'si beradi (qarang: seo.ts), Link sarlavhasi takrorlanmasin
  alternateLinks: false,
  localeCookie: { name: LOCALE_COOKIE_NAME, maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax" },
});
