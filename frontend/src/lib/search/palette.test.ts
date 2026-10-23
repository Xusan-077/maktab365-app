import { describe, expect, it } from "vitest";
import type { PdfSubject } from "@/lib/pdf-books/api";
import { matchGrades, matchSubjects } from "./palette";

describe("matchGrades", () => {
  it("sinf raqami va qo'shimchalar", () => {
    expect(matchGrades("9")).toEqual([9]);
    expect(matchGrades("9-sinf")).toEqual([9]);
    expect(matchGrades("9 sinf")).toEqual([9]);
    expect(matchGrades("9 класс")).toEqual([9]);
    expect(matchGrades("grade 9")).toEqual([9]);
  });
  it("'1' — 1, 10, 11; aniq moslik birinchi", () => {
    expect(matchGrades("1")).toEqual([1, 10, 11]);
    expect(matchGrades("10")).toEqual([10]);
  });
  it("yaroqsiz so'rovlar bo'sh", () => {
    for (const q of ["", "abc", "0", "12", "99", "09", "9a"]) expect(matchGrades(q), q).toEqual([]);
  });
});

describe("matchSubjects", () => {
  const subjects = [
    { slug: "algebra", title: { uz: "Algebra", ru: "Алгебра" }, books_count: 1 },
    { slug: "fizika", title: { uz: "Fizika" }, books_count: 1 },
  ] as unknown as PdfSubject[];
  it("barcha tillardagi nom bo'yicha", () => {
    expect(matchSubjects(subjects, "алг").map((s) => s.slug)).toEqual(["algebra"]);
    expect(matchSubjects(subjects, "xyz")).toEqual([]);
    expect(matchSubjects(subjects, "FIZ").map((s) => s.slug)).toEqual(["fizika"]);
  });
  it("1 belgidan kam so'rovda bo'sh", () => {
    expect(matchSubjects(subjects, "a")).toEqual([]);
  });
});
