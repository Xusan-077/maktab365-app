import { object, string } from "yup";
import { SUPPORT_KINDS } from "@/types/support";
import { isMeaningless, SUPPORT_MESSAGE_MIN } from "./support-quality";

export { SUPPORT_MESSAGE_MIN };
export const SUPPORT_MESSAGE_MAX = 2000;

/** Xabar kalitlari `support.errors.*` ga mos; matnni forma tilga o'giradi. */
export function createSupportSchema({ emailRequired }: { emailRequired: boolean }) {
  const email = string().trim().email("emailInvalid");
  return object({
    kind: string()
      .oneOf([...SUPPORT_KINDS], "kindRequired")
      .required("kindRequired"),
    email: emailRequired ? email.required("emailRequired") : email,
    message: string()
      .trim()
      .required("messageRequired")
      .min(SUPPORT_MESSAGE_MIN, "messageTooShort")
      .max(SUPPORT_MESSAGE_MAX, "messageTooLong")
      // Uzunlik yetarli bo'lsa: "Dnxdnxdnxdnx" kabi ma'nosiz matn (backend ham rad etadi).
      .test("meaningful", "messageMeaningless", (value) => {
        const text = value?.trim() ?? "";
        const sized = text.length >= SUPPORT_MESSAGE_MIN && text.length <= SUPPORT_MESSAGE_MAX;
        return !sized || !isMeaningless(text);
      }),
    // Honeypot: ko'rinmaydi, shuning uchun qoida yo'q.
    website: string().default(""),
  });
}
