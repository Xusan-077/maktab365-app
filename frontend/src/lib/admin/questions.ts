import type { QuestionFormValues } from "@/lib/validation/questions";
import type { LocalizedText } from "@/types/i18n";
import type { AdminQuestion, AdminQuestionInput } from "./types";

/** Mavzu o'yinlar ro'yxatiga kirishi uchun faol savollar (backend `GAMES_MIN_QUESTIONS`). */
export const MIN_GAME_QUESTIONS = 8;

/** Backend model default'i (sxemada `difficulty` ixtiyoriy). */
export const DEFAULT_DIFFICULTY = "medium";

/** Variant harflari (A..D) — ro'yxat tartibi. */
export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

const emptyText = (): Required<LocalizedText> => ({ uz: "", ru: "", en: "" });

const fullText = (value: LocalizedText): Required<LocalizedText> => ({
  uz: value.uz,
  ru: value.ru ?? "",
  en: value.en ?? "",
});

/** Bo'sh tarjimalarni tashlab, matnlarni qirqadi (`LocalizedFields.toLocalized` bilan bir xil). */
export function cleanText(value: LocalizedText): LocalizedText {
  const result: LocalizedText = { uz: value.uz.trim() };
  const ru = value.ru?.trim();
  const en = value.en?.trim();
  if (ru) result.ru = ru;
  if (en) result.en = en;
  return result;
}

/** API savoli → forma qiymatlari (yangi savol uchun bo'sh, to'g'ri javob tanlanmagan). */
export function toQuestionForm(question?: AdminQuestion): QuestionFormValues {
  if (!question) {
    return {
      text: emptyText(),
      image: "",
      difficulty: DEFAULT_DIFFICULTY,
      is_active: true,
      options: OPTION_LETTERS.map(() => ({ text: emptyText() })),
      correct: "",
    };
  }
  const options = [...question.options].sort((a, b) => a.order - b.order);
  return {
    text: fullText(question.text),
    image: question.image ?? "",
    difficulty: question.difficulty ?? DEFAULT_DIFFICULTY,
    is_active: question.is_active ?? true,
    options: options.map((option) => ({ text: fullText(option.text) })),
    correct: String(
      Math.max(
        options.findIndex((option) => option.is_correct),
        0,
      ),
    ),
  };
}

/** Forma → API tanasi: variantlar A..D tartibida, `is_correct` radio tanlovidan. */
export function toQuestionInput(values: QuestionFormValues): AdminQuestionInput {
  return {
    text: cleanText(values.text),
    image: values.image,
    difficulty: values.difficulty,
    is_active: values.is_active,
    options: values.options.map((option, index) => ({
      text: cleanText(option.text),
      is_correct: String(index) === values.correct,
    })),
  };
}

/** Sudrab tashlashdan keyin: `from` dagi elementni `to` ga ko'chiradi (yangi massiv). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
