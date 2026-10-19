import type { LocalizedText } from "@/types/i18n";
import type { Locale } from "./config";
import { latinToCyrillic } from "./translit";

/** Tarjima yo'q yoki bo'sh qator bo'lsa `undefined` (keyin uz'ga fallback qilinadi). */
const filled = (value: string | undefined) => (value?.trim() ? value : undefined);

/** Tilga mos matn: uz-Cyrl uz'dan translit, tarjima yo'q yoki bo'sh bo'lsa uz'ga fallback. */
export function getLocalized(text: LocalizedText, locale: Locale): string {
  switch (locale) {
    case "uz-Cyrl":
      return latinToCyrillic(text.uz);
    case "ru":
      return filled(text.ru) ?? text.uz;
    case "en":
      return filled(text.en) ?? text.uz;
    default:
      return text.uz;
  }
}
