import { array, boolean, mixed, object, string, type InferType } from "yup";

/** Backend bilan bir xil (`apps/games/models.py`): har tildagi matn uzunligi. */
export const QUESTION_LIMITS = { text: 1000, option: 300, options: 4 } as const;
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

const localized = (max: number) =>
  object({
    uz: string().trim().required("required").max(max, "tooLong"),
    ru: string().trim().max(max, "tooLong").default(""),
    en: string().trim().max(max, "tooLong").default(""),
  });

/**
 * Savol formasi: matn, rasm (ixtiyoriy, `uploads/` yo'li), qiyinlik, aniq 4 variant va
 * to'g'ri javob indeksi (radio). Xabar kalitlari — `admin.questions.errors.*`.
 */
export const questionSchema = object({
  text: localized(QUESTION_LIMITS.text),
  image: string().default(""),
  difficulty: mixed<(typeof DIFFICULTIES)[number]>().oneOf(DIFFICULTIES).required("required"),
  is_active: boolean().default(true),
  options: array(object({ text: localized(QUESTION_LIMITS.option) }))
    .length(QUESTION_LIMITS.options, "optionsCount")
    .required(),
  /** To'g'ri variant indeksi ("0".."3"); yangi savolda bo'sh — tanlash majburiy. */
  correct: string()
    .required("correctRequired")
    .matches(/^[0-3]$/, "correctRequired"),
});

export type QuestionFormValues = InferType<typeof questionSchema>;
