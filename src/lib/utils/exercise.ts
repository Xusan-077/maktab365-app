import type { ExerciseBlock } from "@/types/topic";

/** Javob matnini solishtirish uchun: bo'shliq, registr, minus belgisi va o'nli vergul farqi hisobga olinmaydi. */
export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\s+/g, " ");
}

export type ExerciseResponse = number | boolean | string | readonly number[];

type CheckableExercise =
  | { answerType: "choice"; answer: number }
  | { answerType: "truefalse"; answer: boolean }
  | { answerType: "input"; answer: readonly string[] }
  | { answerType: "order"; answer: readonly number[] };

export function isCorrectResponse(
  exercise: CheckableExercise,
  response: ExerciseResponse,
): boolean {
  switch (exercise.answerType) {
    case "order":
      return (
        Array.isArray(response) &&
        response.length === exercise.answer.length &&
        exercise.answer.every((item, index) => item === response[index])
      );
    case "choice":
      return response === exercise.answer;
    case "truefalse":
      return response === exercise.answer;
    case "input":
      return (
        typeof response === "string" &&
        exercise.answer.some((item) => normalizeAnswer(item) === normalizeAnswer(response))
      );
  }
}

export type ExerciseAnswerKind = ExerciseBlock["answerType"];
