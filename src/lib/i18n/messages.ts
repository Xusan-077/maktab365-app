import type { AbstractIntlMessages } from "next-intl";
import { type Locale } from "./config";
import uz from "./messages/uz.json";
import { transliterateMessages, type MessageTree } from "./translit";

const VERBATIM_SUFFIX = "Verbatim";

/**
 * Kirillga o'girilmaydigan xabarlar: tilning o'z nomlari (til tanlagich hamma tilda bir xil)
 * va kaliti "...Verbatim" bilan tugaydiganlar (masalan, ingliz tili namunasidagi inglizcha gap).
 */
const isVerbatim = (path: string) => path === "language.names" || path.endsWith(VERBATIM_SUFFIX);

let cyrillicMessages: AbstractIntlMessages | undefined;

/** uz-Cyrl xabarlari alohida faylda emas: uz.json dan runtime'da o'giriladi (bir marta). */
function getCyrillicMessages(): AbstractIntlMessages {
  cyrillicMessages ??= transliterateMessages(uz as MessageTree, isVerbatim);
  return cyrillicMessages;
}

export async function getMessages(locale: Locale): Promise<AbstractIntlMessages> {
  switch (locale) {
    case "uz":
      return uz;
    case "uz-Cyrl":
      return getCyrillicMessages();
    case "ru":
      return (await import("./messages/ru.json")).default;
    case "en":
      return (await import("./messages/en.json")).default;
  }
}
