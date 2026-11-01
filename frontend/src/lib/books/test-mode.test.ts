import { describe, expect, it } from "vitest";
import type { AnswerSheet } from "./api";
import {
  answerMap,
  choiceLetters,
  nextQuestionOnPage,
  questionsOnPage,
  scorePercent,
  sheetProgress,
  splitAttempt,
  withAnswer,
} from "./test-mode";

const sheet: AnswerSheet = {
  choices: 4,
  questions: [
    { page: 2, question: 1, kind: "choice" },
    { page: 1, question: 2, kind: "choice" },
    { page: 1, question: 1, kind: "choice" },
    { page: 2, question: 2, kind: "text" },
  ],
  answers: [{ page: 1, question: 1, answer: "A" }],
};

describe("test rejimi: varaq", () => {
  it("variantlar soni 2..5 oralig'ida", () => {
    expect(choiceLetters(4)).toEqual(["A", "B", "C", "D"]);
    expect(choiceLetters(5)).toEqual(["A", "B", "C", "D", "E"]);
    expect(choiceLetters(99)).toHaveLength(5);
    expect(choiceLetters(0)).toEqual(["A", "B"]);
  });

  it("betdagi savollar tartiblanadi", () => {
    expect(questionsOnPage(sheet, 1).map((q) => q.question)).toEqual([1, 2]);
    expect(questionsOnPage(sheet, 3)).toEqual([]);
  });

  it("progress faqat mavjud savollarni sanaydi", () => {
    expect(sheetProgress(sheet)).toEqual({ answered: 1, total: 4 });
    const stale = { ...sheet, answers: [...sheet.answers, { page: 9, question: 9, answer: "B" }] };
    expect(sheetProgress(stale).answered).toBe(1);
  });

  it("withAnswer almashtiradi, bo'sh javob o'chiradi, asl nusxani o'zgartirmaydi", () => {
    const changed = withAnswer(sheet, 1, 1, "B");
    expect(answerMap(changed).get("1:1")).toBe("B");
    expect(changed.answers).toHaveLength(1);
    const added = withAnswer(sheet, 1, 2, " c ");
    expect(answerMap(added).get("1:2")).toBe("c");
    expect(withAnswer(sheet, 1, 1, "  ").answers).toEqual([]);
    expect(sheet.answers).toHaveLength(1);
  });

  it("keyingi javobsiz savolga o'tadi, oxirida to'xtaydi", () => {
    const list = questionsOnPage(sheet, 1);
    const answers = answerMap(sheet);
    expect(nextQuestionOnPage(list, answers, 0)).toBe(1);
    expect(nextQuestionOnPage(list, answers, 1)).toBe(1);
  });
});

describe("test rejimi: natija", () => {
  const attempt = {
    items: [
      { page: 2, question: 1, correct: false, given: null },
      { page: 1, question: 2, correct: false, given: "D" },
      { page: 1, question: 1, correct: true, given: "A" },
    ],
  };

  it("to'g'ri va xatolarni ajratadi, xatolar bet tartibida", () => {
    const split = splitAttempt(attempt);
    expect(split.correct).toHaveLength(1);
    expect(split.wrong.map((i) => [i.page, i.question])).toEqual([
      [1, 2],
      [2, 1],
    ]);
    expect(split.unanswered).toBe(1);
  });

  it("foiz", () => {
    expect(scorePercent(2, 3)).toBe(67);
    expect(scorePercent(0, 0)).toBe(0);
  });
});
