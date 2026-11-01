import type { AnswerAttemptDetail, AnswerSheet, AnswerSheetQuestion } from "./api";

/** Test kitob rejimi: javoblar varag'i bilan ishlovchi sof mantiq (DOM'siz, testlanadi). */

const LETTERS = ["A", "B", "C", "D", "E"] as const;

export const ANSWER_MAX_LENGTH = 120;

/** Variantlar harflari (kalitda E bor bo'lsa 5 ta, aks holda 4 ta). */
export function choiceLetters(count: number): string[] {
  return LETTERS.slice(0, Math.min(Math.max(count, 2), LETTERS.length));
}

export const questionKey = (page: number, question: number) => `${page}:${question}`;

/** Bet va savol raqami bo'yicha tartiblangan savollar. */
export function sortQuestions<T extends { page: number; question: number }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => a.page - b.page || a.question - b.question);
}

export function questionsOnPage(sheet: AnswerSheet, page: number): AnswerSheetQuestion[] {
  return sortQuestions(sheet.questions.filter((item) => item.page === page));
}

/** `page:question` → javob. */
export function answerMap(sheet: AnswerSheet): Map<string, string> {
  return new Map(sheet.answers.map((row) => [questionKey(row.page, row.question), row.answer]));
}

export interface SheetProgress {
  answered: number;
  total: number;
}

export function sheetProgress(sheet: AnswerSheet): SheetProgress {
  const valid = new Set(sheet.questions.map((item) => questionKey(item.page, item.question)));
  const answered = new Set(
    sheet.answers.map((row) => questionKey(row.page, row.question)).filter((key) => valid.has(key)),
  );
  return { answered: answered.size, total: sheet.questions.length };
}

/** Optimistik yangilash: bo'sh javob yozuvni olib tashlaydi, aks holda almashtiradi. */
export function withAnswer(
  sheet: AnswerSheet,
  page: number,
  question: number,
  answer: string,
): AnswerSheet {
  const rest = sheet.answers.filter((row) => !(row.page === page && row.question === question));
  const value = answer.trim();
  return {
    ...sheet,
    answers: value ? sortQuestions([...rest, { page, question, answer: value }]) : rest,
  };
}

/**
 * Tez javobdan keyin keyingi savol: shu betdagi keyingi javobsiz savol, bo'lmasa keyingisi,
 * oxirgisida o'zi.
 */
export function nextQuestionOnPage(
  questions: readonly AnswerSheetQuestion[],
  answers: ReadonlyMap<string, string>,
  currentIndex: number,
): number {
  for (let index = currentIndex + 1; index < questions.length; index += 1) {
    const item = questions[index];
    if (!answers.has(questionKey(item.page, item.question))) return index;
  }
  return Math.min(currentIndex + 1, questions.length - 1);
}

export interface AttemptSplit {
  correct: AnswerAttemptDetail["items"];
  wrong: AnswerAttemptDetail["items"];
  unanswered: number;
}

/** Natijani to'g'ri va xato savollarga ajratadi (har ikkalasi bet/savol tartibida). */
export function splitAttempt(attempt: Pick<AnswerAttemptDetail, "items">): AttemptSplit {
  const items = sortQuestions(attempt.items);
  return {
    correct: items.filter((item) => item.correct),
    wrong: items.filter((item) => !item.correct),
    unanswered: items.filter((item) => item.given === null).length,
  };
}

export function scorePercent(score: number, total: number): number {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}
