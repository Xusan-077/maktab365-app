import type { AbstractIntlMessages } from "next-intl";
import { type Locale } from "./config";
import uz from "./messages/uz.json";
import uzCyrl from "./messages/uz-Cyrl.json";

/**
 * uz-Cyrl xabarlari `messages/uz-Cyrl.json` da (qo'lda tahrirlanadi). Boshlang'ich fayl
 * `scripts/translit-uz-cyrl.ts` bilan uz.json dan yaratilgan; yangi uz kalitlari uchun:
 * `npx tsx scripts/translit-uz-cyrl.ts --missing-only` (mavjud tuzatishlarga tegmaydi).
 */
export async function getMessages(locale: Locale): Promise<AbstractIntlMessages> {
  switch (locale) {
    case "uz":
      return uz;
    case "uz-Cyrl":
      return uzCyrl;
    case "ru":
      return (await import("./messages/ru.json")).default;
    case "en":
      return (await import("./messages/en.json")).default;
  }
}
