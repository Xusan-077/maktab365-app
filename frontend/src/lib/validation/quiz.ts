import { array, boolean, mixed, number, object, string, type InferType } from "yup";
import { QUIZ_LIMITS } from "@/lib/quizzes/types";

/**
 * Test formasi (`/ustoz/testlar/yangi`, `…/tahrirlash`). Xabar kalitlari — `quizzes.form.errors.*`.
 */
const optionSchema = object({
  id: string().optional(),
  text: string().trim().required("optionRequired").max(QUIZ_LIMITS.optionText, "optionTooLong"),
  isCorrect: boolean().required(),
});

const questionSchema = object({
  id: string().optional(),
  text: string()
    .trim()
    .required("questionRequired")
    .max(QUIZ_LIMITS.questionText, "questionTooLong"),
  image: string().default(""),
  imageUrl: string().nullable().default(null),
  options: array(optionSchema)
    .required()
    .min(QUIZ_LIMITS.optionsMin, "optionsMin")
    .max(QUIZ_LIMITS.optionsMax, "optionsMax")
    .test(
      "one-correct",
      "correctRequired",
      (options) => options.filter((option) => option.isCorrect).length === 1,
    ),
});

export const quizFormSchema = object({
  title: string().trim().required("titleRequired").max(QUIZ_LIMITS.title, "titleTooLong"),
  description: string().trim().max(QUIZ_LIMITS.description, "descriptionTooLong").default(""),
  categoryId: string().default(""),
  coverImage: string().default(""),
  coverUrl: string().nullable().default(null),
  visibility: mixed<"private" | "public">().oneOf(["private", "public"]).required(),
  timePerQuestion: number().oneOf([0, 15, 30, 60]).required(),
  shuffleQuestions: boolean().required(),
  shuffleOptions: boolean().required(),
  questions: array(questionSchema)
    .required()
    .min(1, "questionsMin")
    .max(QUIZ_LIMITS.questionsMax, "questionsMax"),
});

export type QuizFormValues = InferType<typeof quizFormSchema>;
