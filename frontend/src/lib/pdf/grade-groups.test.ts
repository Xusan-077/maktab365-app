import { describe, expect, it } from "vitest";
import { parseGradeParam } from "./grade-groups";

describe("parseGradeParam", () => {
  it("faqat 1..11 butun sonni qabul qiladi", () => {
    expect(parseGradeParam("1")).toBe(1);
    expect(parseGradeParam("9")).toBe(9);
    expect(parseGradeParam("11")).toBe(11);
  });
  it("qolganini rad etadi", () => {
    for (const bad of ["0", "12", "09", "9.5", "abc", "", "-1", " 9"]) {
      expect(parseGradeParam(bad), bad).toBeNull();
    }
  });
});
