import type { QuizFormValues } from "@/lib/validation/quiz";
import { QUIZ_LIMITS, type Quiz, type QuizInput } from "./types";

type QuestionValues = QuizFormValues["questions"][number];
type OptionValues = QuestionValues["options"][number];

const blankOption = (isCorrect: boolean): OptionValues => ({ text: "", isCorrect });

export const blankQuestion = (): QuestionValues => ({
  text: "",
  image: "",
  imageUrl: null,
  options: [blankOption(true), blankOption(false)],
});

export const newQuizValues = (): QuizFormValues => ({
  title: "",
  description: "",
  categoryId: "",
  coverImage: "",
  coverUrl: null,
  visibility: "private",
  timePerQuestion: 0,
  shuffleQuestions: false,
  shuffleOptions: false,
  questions: [blankQuestion()],
});

/** API → forma (taymersiz test `0`: `SegmentedControl` qiymatlari satr). */
export function quizToFormValues(quiz: Quiz): QuizFormValues {
  return {
    title: quiz.title,
    description: quiz.description ?? "",
    categoryId: quiz.category?.id ?? "",
    coverImage: quiz.cover_image ?? "",
    coverUrl: quiz.cover_url,
    visibility: quiz.visibility ?? "private",
    timePerQuestion: quiz.time_per_question ?? 0,
    shuffleQuestions: quiz.shuffle_questions ?? false,
    shuffleOptions: quiz.shuffle_options ?? false,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      text: question.text,
      image: question.image ?? "",
      imageUrl: question.image_url,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        isCorrect: option.is_correct ?? false,
      })),
    })),
  };
}

/** Forma → API (`snake_case`; bo'sh kategoriya/taymer `null`). */
export function formValuesToInput(values: QuizFormValues): QuizInput {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    category_id: values.categoryId || null,
    cover_image: values.coverImage || null,
    visibility: values.visibility,
    time_per_question: (values.timePerQuestion || null) as QuizInput["time_per_question"],
    shuffle_questions: values.shuffleQuestions,
    shuffle_options: values.shuffleOptions,
    questions: values.questions.map((question) => ({
      id: question.id,
      text: question.text.trim(),
      image: question.image || null,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text.trim(),
        is_correct: option.isCorrect,
      })),
    })),
  };
}

/** `index` dagi variantni to'g'ri qiladi, qolganlarini olib tashlaydi. */
export function markCorrect<T extends { isCorrect: boolean }>(options: T[], index: number): T[] {
  return options.map((option, i) => ({ ...option, isCorrect: i === index }));
}

/** Variant o'chirilganda to'g'ri javob yo'qolsa — birinchisi to'g'ri bo'ladi. */
export function ensureOneCorrect<T extends { isCorrect: boolean }>(options: T[]): T[] {
  return options.some((option) => option.isCorrect) ? options : markCorrect(options, 0);
}

export const canAddOption = (count: number) => count < QUIZ_LIMITS.optionsMax;
export const canRemoveOption = (count: number) => count > QUIZ_LIMITS.optionsMin;
