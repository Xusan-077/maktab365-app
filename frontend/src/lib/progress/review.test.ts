import { describe, expect, it } from "vitest";
import type { Progress } from "@/types/progress";
import {
  groupByMastery,
  hasActivity,
  masteryOf,
  needsReview,
  pickContinue,
  reviewTopics,
} from "./review";

const progress = (topicId: string, patch: Partial<Progress> = {}): Progress => ({
  userId: "u",
  topicId,
  readStatus: "none",
  exerciseStatus: "none",
  updatedAt: "2026-03-09T12:00:00.000Z",
  mistakes: [],
  ...patch,
});

describe("masteryOf", () => {
  it("xato bo'lsa takrorlash kerak, hatto mashqlar tugagan bo'lsa ham", () => {
    expect(masteryOf(progress("a", { exerciseStatus: "completed", mistakes: ["e1"] }))).toBe(
      "review",
    );
  });

  it("mashqlar xatosiz tugagan bo'lsa yaxshi o'zlashtirilgan", () => {
    expect(masteryOf(progress("a", { readStatus: "completed", exerciseStatus: "completed" }))).toBe(
      "mastered",
    );
  });

  it("faqat o'qilgan mavzu hali jarayonda", () => {
    expect(masteryOf(progress("a", { readStatus: "completed" }))).toBe("inProgress");
  });
});

describe("groupByMastery", () => {
  it("bo'sh yozuvlarni tashlaydi va yangisini birinchi qo'yadi", () => {
    const groups = groupByMastery([
      progress("empty"),
      progress("old", { exerciseStatus: "completed", updatedAt: "2026-03-01T00:00:00.000Z" }),
      progress("new", { exerciseStatus: "completed", updatedAt: "2026-03-08T00:00:00.000Z" }),
      progress("bad", { exerciseStatus: "in_progress", mistakes: ["e1"] }),
      progress("read", { readStatus: "started" }),
    ]);
    expect(groups.mastered.map((item) => item.topicId)).toEqual(["new", "old"]);
    expect(groups.review.map((item) => item.topicId)).toEqual(["bad"]);
    expect(groups.inProgress.map((item) => item.topicId)).toEqual(["read"]);
  });

  it("o'qilgan va mashq holatlari alohida saqlanadi", () => {
    const [item] = groupByMastery([
      progress("a", { readStatus: "completed", exerciseStatus: "in_progress" }),
    ]).inProgress;
    expect(item.readStatus).toBe("completed");
    expect(item.exerciseStatus).toBe("in_progress");
  });
});

describe("hasActivity", () => {
  it("hech narsa qilinmagan yozuv faol emas", () => {
    expect(hasActivity(progress("a"))).toBe(false);
    expect(hasActivity(progress("a", { mistakes: ["e1"] }))).toBe(true);
  });
});

describe("pickContinue", () => {
  it("eng oxirgi tugamagan mavzuni tanlaydi", () => {
    const picked = pickContinue([
      progress("done", {
        readStatus: "completed",
        exerciseStatus: "completed",
        updatedAt: "2026-03-09T20:00:00.000Z",
      }),
      progress("half", { readStatus: "started", updatedAt: "2026-03-09T10:00:00.000Z" }),
      progress("older", { readStatus: "started", updatedAt: "2026-03-01T10:00:00.000Z" }),
    ]);
    expect(picked?.topicId).toBe("half");
  });

  it("hammasi tugagan bo'lsa yoki yozuv bo'lmasa undefined", () => {
    expect(pickContinue([])).toBeUndefined();
    expect(
      pickContinue([progress("a", { readStatus: "completed", exerciseStatus: "completed" })]),
    ).toBeUndefined();
  });

  it("xatosi bor tugagan mavzu ham davom ettirish uchun mos", () => {
    expect(
      pickContinue([
        progress("a", { readStatus: "completed", exerciseStatus: "completed", mistakes: ["e"] }),
      ])?.topicId,
    ).toBe("a");
  });
});

describe("needsReview / reviewTopics", () => {
  it("takrorlash faqat mistakes[] dan hisoblanadi", () => {
    expect(needsReview(progress("a", { mistakes: ["e1"] }))).toBe(true);
    expect(needsReview(progress("a", { exerciseStatus: "in_progress" }))).toBe(false);
  });

  it("xatosi ko'p mavzu birinchi, teng bo'lsa yangisi", () => {
    const list = reviewTopics([
      progress("one-old", { mistakes: ["a"], updatedAt: "2026-03-01T00:00:00.000Z" }),
      progress("clean"),
      progress("two", { mistakes: ["a", "b"], updatedAt: "2026-02-01T00:00:00.000Z" }),
      progress("one-new", { mistakes: ["a"], updatedAt: "2026-03-05T00:00:00.000Z" }),
    ]);
    expect(list.map((item) => item.topicId)).toEqual(["two", "one-new", "one-old"]);
  });
});
