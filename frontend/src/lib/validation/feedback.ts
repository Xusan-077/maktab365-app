import { object, string } from "yup";
import { FEEDBACK_KINDS } from "@/types/feedback";

export const FEEDBACK_MESSAGE_MIN = 10;
export const FEEDBACK_MESSAGE_MAX = 1000;

/** Xabar kalitlari `panel.helpPage.errors.*` ga mos; matnni forma tilga o'giradi. */
export const feedbackSchema = object({
  kind: string()
    .oneOf([...FEEDBACK_KINDS], "kindRequired")
    .required("kindRequired"),
  message: string()
    .trim()
    .required("messageRequired")
    .min(FEEDBACK_MESSAGE_MIN, "messageTooShort")
    .max(FEEDBACK_MESSAGE_MAX, "messageTooLong"),
});
