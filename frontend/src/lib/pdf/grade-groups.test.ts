import { describe, expect, it } from "vitest";
import { countBooksByGrade, groupSubjects, parseGradeParam } from "./grade-groups";

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

describe("countBooksByGrade", () => {
  it("sinf → kitoblar soni (kitobsiz sinf yo'q)", () => {
    expect(countBooksByGrade([{ grade: 1 }, { grade: 9 }, { grade: 1 }])).toEqual({ 1: 2, 9: 1 });
    expect(countBooksByGrade([])).toEqual({});
  });
});

describe("groupSubjects", () => {
  const subject = (slug: string, group: string, books: number, order = 1) => ({
    slug,
    group,
    order,
    books_count: books,
    title: { uz: slug },
    icon: "",
    grades: [1],
  });

  it("faqat shu yo'nalishdagi kitobi bor fanlar, tartib bo'yicha", () => {
    const subjects = [
      subject("geometriya", "exact", 2, 3),
      subject("algebra", "exact", 4, 2),
      subject("fizika", "natural", 1),
      subject("informatika", "exact", 0),
    ];
    expect(groupSubjects(subjects, "exact").map((s) => s.slug)).toEqual(["algebra", "geometriya"]);
    expect(groupSubjects(subjects, "arts")).toEqual([]);
  });
});
