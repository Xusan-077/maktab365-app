import { describe, expect, it } from "vitest";
import {
  buildPlayQuestions,
  buildReview,
  formatClock,
  INITIAL_PLAY_STATE,
  percentOf,
  playReducer,
  scoreOf,
  shuffle,
  toAttemptInput,
  type Pick,
} from "./play";

const source = [
  {
    id: "q1",
    text: "Bir",
    options: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  },
  {
    id: "q2",
    text: "Ikki",
    options: [
      { id: "c", text: "C" },
      { id: "d", text: "D" },
    ],
  },
];
const first = () => 0;
const plain = { shuffleQuestions: false, shuffleOptions: false };

describe("shuffle", () => {
  it("asl massivni o'zgartirmaydi va elementlarni saqlaydi", () => {
    const items = [1, 2, 3, 4];
    const result = shuffle(items, first);
    expect(items).toEqual([1, 2, 3, 4]);
    expect([...result].sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("buildPlayQuestions", () => {
  it("aralashtirmasa tartib saqlanadi", () => {
    const result = buildPlayQuestions(source, plain);
    expect(result.map((q) => q.id)).toEqual(["q1", "q2"]);
    expect(result[0].options.map((o) => o.id)).toEqual(["a", "b"]);
  });
  it("savollarni aralashtiradi", () => {
    const result = buildPlayQuestions(source, { ...plain, shuffleQuestions: true }, first);
    expect(result.map((q) => q.id)).toEqual(["q2", "q1"]);
  });
});

describe("playReducer", () => {
  const pick: Pick = { questionId: "q1", optionId: "a", correct: true, correctOptionId: "a" };
  it("reveal → next → finished", () => {
    let state = playReducer(INITIAL_PLAY_STATE, { type: "reveal", pick });
    expect(state.phase).toBe("revealed");
    state = playReducer(state, { type: "next", total: 2 });
    expect(state).toMatchObject({ index: 1, phase: "answering" });
    state = playReducer(state, { type: "reveal", pick: { ...pick, questionId: "q2" } });
    state = playReducer(state, { type: "next", total: 2 });
    expect(state.phase).toBe("finished");
  });
  it("ikkinchi javob e'tiborga olinmaydi", () => {
    const once = playReducer(INITIAL_PLAY_STATE, { type: "reveal", pick });
    expect(playReducer(once, { type: "reveal", pick })).toBe(once);
  });
});

describe("natija", () => {
  const questions = buildPlayQuestions(source, plain);
  const picks: Pick[] = [
    { questionId: "q1", optionId: "b", correct: false, correctOptionId: "a" },
    { questionId: "q2", optionId: null, correct: false, correctOptionId: "d" },
  ];
  it("ball va foiz", () => {
    expect(scoreOf(picks)).toBe(0);
    expect(percentOf(2, 3)).toBe(66);
    expect(percentOf(0, 0)).toBe(0);
  });
  it("xatolar ro'yxati", () => {
    expect(buildReview(questions, picks)).toEqual([
      { questionId: "q1", question: "Bir", chosenText: "B", correctText: "A", correct: false },
      { questionId: "q2", question: "Ikki", chosenText: null, correctText: "D", correct: false },
    ]);
  });
  it("serverga javobsizlar null bilan ketadi", () => {
    expect(toAttemptInput(questions, [picks[0]], 12.4)).toEqual({
      answers: [
        { question_id: "q1", option_id: "b" },
        { question_id: "q2", option_id: null },
      ],
      time_spent: 12,
    });
  });
  it("soat formati", () => {
    expect(formatClock(83)).toBe("1:23");
    expect(formatClock(5)).toBe("0:05");
  });
});
