import { describe, expect, it } from "vitest";
import { parseCatalogParams, toBookFilters, toSearchParams } from "./catalog-params";

const parse = (query: string) => {
  const params = new URLSearchParams(query);
  return parseCatalogParams((name) => params.get(name));
};

describe("catalog-params", () => {
  it("to'g'ri qiymatlarni o'qiydi", () => {
    expect(parse("grade=9&subject=algebra&q=%20viyet%20")).toEqual({
      grade: 9,
      subject: "algebra",
      q: "viyet",
    });
  });

  it("noto'g'ri sinf va bo'sh qiymatlarni tashlab yuboradi", () => {
    expect(parse("grade=12&subject=&q=")).toEqual({});
    expect(parse("grade=abc")).toEqual({});
  });

  it("uzun qidiruvni qisqartiradi", () => {
    expect(parse(`q=${"a".repeat(300)}`).q).toHaveLength(100);
  });

  it("toSearchParams boshqa parametrlarni saqlaydi va filtrlarni almashtiradi", () => {
    const next = toSearchParams(
      { grade: 5, q: "son" },
      new URLSearchParams("grade=9&subject=x&utm=1"),
    );
    expect(next.toString()).toBe("utm=1&grade=5&q=son");
  });

  it("toBookFilters bo'sh kalit qoldirmaydi", () => {
    expect(toBookFilters({})).toEqual({});
    expect(toBookFilters({ grade: 9, subject: "algebra", q: "x" })).toEqual({
      grade: 9,
      subjectId: "algebra",
      q: "x",
    });
  });
});
