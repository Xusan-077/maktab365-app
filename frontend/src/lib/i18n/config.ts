export const locales = ["uz", "uz-Cyrl", "ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "uz";

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | undefined): value is Locale {
  return locales.some((locale) => locale === value);
}
