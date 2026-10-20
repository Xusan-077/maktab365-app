import { object, string } from "yup";
import { SUPPORT_KINDS } from "@/types/support";

export const SUPPORT_MESSAGE_MIN = 10;
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
      .max(SUPPORT_MESSAGE_MAX, "messageTooLong"),
    // Honeypot: ko'rinmaydi, shuning uchun qoida yo'q.
    website: string().default(""),
  });
}
