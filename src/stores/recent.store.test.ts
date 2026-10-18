import { describe, expect, it } from "vitest";
import { addVisit, RECENT_LIMIT } from "./recent.store";

const NOW = new Date("2026-03-10T12:00:00.000Z");

describe("addVisit", () => {
  it("yangi mavzuni boshiga qo'yadi va takrorlamaydi", () => {
    const first = addVisit([], "a", NOW);
    const second = addVisit(first, "b", NOW);
    expect(addVisit(second, "a", NOW).map((item) => item.topicId)).toEqual(["a", "b"]);
  });

  it("chegaradan oshganda eskisini tashlaydi", () => {
    let visits = addVisit([], "t0", NOW);
    for (let i = 1; i <= RECENT_LIMIT; i++) visits = addVisit(visits, `t${i}`, NOW);
    expect(visits).toHaveLength(RECENT_LIMIT);
    expect(visits.some((item) => item.topicId === "t0")).toBe(false);
  });
});
