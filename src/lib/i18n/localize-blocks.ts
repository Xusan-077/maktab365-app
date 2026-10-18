import type { LocalizedText } from "@/types/i18n";
import type { Locale } from "./config";
import { getLocalized } from "./localized";

/** `LocalizedText` ni tilga mos `string` ga o'tkazilgan tip (client'ga faqat kerakli til yuboriladi). */
export type Resolved<T> = T extends LocalizedText
  ? string
  : T extends readonly (infer U)[]
    ? Resolved<U>[]
    : T extends object
      ? { [K in keyof T]: Resolved<T[K]> }
      : T;

const LOCALIZED_KEYS = new Set(["uz", "ru", "en"]);

function isLocalizedText(value: unknown): value is LocalizedText {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as LocalizedText).uz === "string" &&
    Object.keys(value).every((key) => LOCALIZED_KEYS.has(key))
  );
}

/** Obyekt ichidagi barcha `LocalizedText` ni rekursiv ravishda tanlangan tilga o'giradi. */
export function localize<T>(value: T, locale: Locale): Resolved<T> {
  if (isLocalizedText(value)) return getLocalized(value, locale) as Resolved<T>;
  if (Array.isArray(value)) return value.map((item) => localize(item, locale)) as Resolved<T>;
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, localize(item, locale)]),
    ) as Resolved<T>;
  }
  return value as Resolved<T>;
}
