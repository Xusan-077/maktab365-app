import { describe, expect, it } from "vitest";
import { effectiveSelection, filterBooks, toggleValue } from "./teacher-filters";

const books = [
  { id: "a9", subjectId: "algebra", grade: 9 },
  { id: "g9", subjectId: "geometry", grade: 9 },
  { id: "a8", subjectId: "algebra", grade: 8 },
];

describe("effectiveSelection", () => {
  it("tanlov bo'lmasa profildagi fan va sinflarni oladi", () => {
    expect(
      effectiveSelection({ subjects: null, grades: null }, { subjects: ["algebra"], grades: [9] }),
    ).toEqual({ subjects: ["algebra"], grades: [9] });
  });

  it("tanlangan qiymat profilni bosib o'tadi, bo'sh ro'yxat esa cheklovsiz", () => {
    expect(
      effectiveSelection({ subjects: [], grades: [8] }, { subjects: ["algebra"], grades: [9] }),
    ).toEqual({ subjects: [], grades: [8] });
  });
});

describe("filterBooks", () => {
  it("fan va sinf bo'yicha birga filtrlaydi", () => {
    expect(
      filterBooks(books, { subjects: ["algebra"], grades: [9] }).map((book) => book.id),
    ).toEqual(["a9"]);
  });

  it("bo'sh tanlov hammasini qaytaradi", () => {
    expect(filterBooks(books, { subjects: [], grades: [] })).toHaveLength(3);
    expect(filterBooks(books, { subjects: [], grades: [9] })).toHaveLength(2);
  });
});

describe("toggleValue", () => {
  it("qiymatni qo'shadi va olib tashlaydi", () => {
    expect(toggleValue([1], 2)).toEqual([1, 2]);
    expect(toggleValue([1, 2], 1)).toEqual([2]);
  });
});
