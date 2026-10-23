import { describe, expect, it } from "vitest";
import { formatGrades, normalizeGrades, parseGradeRange, subjectHasGrade } from "./grades";

describe("formatGrades", () => {
  it("collapses ranges of three or more", () => {
    expect(formatGrades([5, 6, 7, 8, 9, 10, 11])).toBe("5–11");
    expect(formatGrades([1, 2, 3, 4, 7, 9])).toBe("1–4, 7, 9");
    expect(formatGrades([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toBe("1–11");
  });
  it("keeps pairs separate and sorts input", () => {
    expect(formatGrades([6, 5])).toBe("5, 6");
    expect(formatGrades([11, 3, 4, 5, 3])).toBe("3–5, 11");
    expect(formatGrades([])).toBe("");
  });
});

describe("parseGradeRange", () => {
  it("parses ranges and lists, dropping out-of-range values", () => {
    expect(parseGradeRange("5–11")).toEqual([5, 6, 7, 8, 9, 10, 11]);
    expect(parseGradeRange("1-4, 7, 9")).toEqual([1, 2, 3, 4, 7, 9]);
    expect(parseGradeRange("9-13 x")).toEqual([9, 10, 11]);
    expect(parseGradeRange("")).toEqual([]);
  });
});

it("normalizes and checks membership", () => {
  expect(normalizeGrades([3, 1, 3])).toEqual([1, 3]);
  expect(subjectHasGrade({ grades: [7, 8] }, 7)).toBe(true);
  expect(subjectHasGrade({ grades: [7, 8] }, 5)).toBe(false);
  expect(subjectHasGrade({}, 5)).toBe(false);
});
