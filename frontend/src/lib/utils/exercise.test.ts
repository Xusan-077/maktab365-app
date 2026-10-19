import { describe, expect, it } from "vitest";
import { isCorrectResponse, normalizeAnswer } from "./exercise";

describe("normalizeAnswer", () => {
  it("minus, registr, bo'shliq va vergulni tenglashtiradi", () => {
    expect(normalizeAnswer("  −5 ")).toBe("-5");
    expect(normalizeAnswer("Has  Been")).toBe("has been");
    expect(normalizeAnswer("2,5")).toBe("2.5");
  });
});

describe("isCorrectResponse", () => {
  it("input: bir nechta qabul qilinadigan javob", () => {
    const exercise = { answerType: "input", answer: ["-5", "−5"] } as const;
    expect(isCorrectResponse(exercise, " −5")).toBe(true);
    expect(isCorrectResponse(exercise, "5")).toBe(false);
  });

  it("choice va truefalse", () => {
    expect(isCorrectResponse({ answerType: "choice", answer: 2 }, 2)).toBe(true);
    expect(isCorrectResponse({ answerType: "choice", answer: 2 }, 1)).toBe(false);
    expect(isCorrectResponse({ answerType: "truefalse", answer: false }, false)).toBe(true);
    expect(isCorrectResponse({ answerType: "truefalse", answer: false }, true)).toBe(false);
  });

  it("order: faqat aynan to'g'ri tartib to'g'ri hisoblanadi", () => {
    const exercise = { answerType: "order", answer: [2, 0, 1] } as const;
    expect(isCorrectResponse(exercise, [2, 0, 1])).toBe(true);
    expect(isCorrectResponse(exercise, [0, 1, 2])).toBe(false);
    expect(isCorrectResponse(exercise, [2, 0])).toBe(false);
    expect(isCorrectResponse(exercise, "2,0,1")).toBe(false);
  });
});
