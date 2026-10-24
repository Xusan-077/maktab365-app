import { describe, expect, it } from "vitest";
import type { PdfBook } from "@/lib/pdf-books/api";
import {
  filterBooks,
  groupCounts,
  groupParam,
  gradeStats,
  matchesQuery,
  parseGradeParam,
  parseGroupParam,
} from "./grade-groups";

const book = (over: Partial<PdfBook>): PdfBook => ({
  id: "b",
  slug: "9-sinf-x",
  title: { uz: "Algebra" },
  grade: 9,
  subject: "algebra",
  subject_title: { uz: "Algebra" },
  subject_group: "exact",
  page_count: 100,
  size_bytes: 1024 * 1024,
  cover: null,
  cover_small: null,
  language: "uz",
  unverified: false,
  published_at: null,
  ...over,
});

const BOOKS = [
  book({ id: "1", title: { uz: "Algebra", ru: "Алгебра" } }),
  book({ id: "2", title: { uz: "Biologiya" }, subject: "biologiya", subject_group: "natural" }),
  book({ id: "3", title: { uz: "Kimyo" }, subject: "kimyo", subject_group: "natural" }),
  book({ id: "4", title: { uz: "Noma'lum" }, subject: "x", subject_group: "" }),
];

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

describe("guruh parametri", () => {
  it("URL qiymati ↔ guruh", () => {
    expect(parseGroupParam("tabiiy")).toBe("natural");
    expect(parseGroupParam("aniq")).toBe("exact");
    expect(groupParam("language")).toBe("tillar");
    expect(groupParam("all")).toBeUndefined();
  });
  it("noma'lum qiymat — Hammasi", () => {
    expect(parseGroupParam("xyz")).toBe("all");
    expect(parseGroupParam(null)).toBe("all");
  });
});

describe("filtr", () => {
  it("nom bo'yicha barcha tillarda, katta-kichik harfga e'tiborsiz", () => {
    expect(matchesQuery(BOOKS[0], "алгеб")).toBe(true);
    expect(matchesQuery(BOOKS[0], "ALGE")).toBe(true);
    expect(matchesQuery(BOOKS[0], "fizika")).toBe(false);
    expect(matchesQuery(BOOKS[0], "  ")).toBe(true);
  });
  it("guruh va qidiruv birga", () => {
    expect(filterBooks(BOOKS, { group: "natural", q: "" }).map((b) => b.id)).toEqual(["2", "3"]);
    expect(filterBooks(BOOKS, { group: "natural", q: "kim" }).map((b) => b.id)).toEqual(["3"]);
    expect(filterBooks(BOOKS, { group: "all", q: "" })).toHaveLength(4);
  });
  it("tab sonlari qidiruvni hisobga oladi; guruhsiz kitob faqat Hammasi da", () => {
    expect(groupCounts(BOOKS, "")).toMatchObject({ all: 4, exact: 1, natural: 2, language: 0 });
    expect(groupCounts(BOOKS, "kim")).toMatchObject({ all: 1, natural: 1, exact: 0 });
  });
});

describe("gradeStats", () => {
  it("faqat haqiqiy yig'indi", () => {
    expect(gradeStats(BOOKS)).toEqual({ count: 4, totalBytes: 4 * 1024 * 1024 });
    expect(gradeStats([])).toEqual({ count: 0, totalBytes: 0 });
  });
});
