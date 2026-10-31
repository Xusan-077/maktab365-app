import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type Quiz = Schemas["Quiz"];
export type QuizSummary = Schemas["QuizList"];
export type QuizInput = Schemas["QuizRequest"];
export type QuizCategory = Schemas["Category"];
export type QuizAttempt = Schemas["Attempt"];
export type AttemptReview = Schemas["AttemptReview"];
export type AttemptInput = Schemas["AttemptCreateRequest"];
export type PublicQuiz = Schemas["PublicQuiz"];
export type CheckResult = Schemas["CheckResult"];
export type QuizVisibility = Schemas["VisibilityEnum"];

/** Taymer qiymatlari (soniya); `null` — taymersiz. */
export const TIME_PER_QUESTION = [15, 30, 60] as const;
export type TimePerQuestion = (typeof TIME_PER_QUESTION)[number] | null;

/** Backend chegaralari (`apps/quizzes/models.py`) bilan bir xil. */
export const QUIZ_LIMITS = {
  title: 120,
  description: 1000,
  categoryName: 40,
  questionText: 500,
  optionText: 200,
  optionsMin: 2,
  optionsMax: 6,
  questionsMax: 100,
} as const;
