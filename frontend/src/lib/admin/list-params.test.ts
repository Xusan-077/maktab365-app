import { describe, expect, it } from "vitest";
import { parseBookParams, serializeBookParams, withFilter } from "./list-params";

const parse = (query: string) => parseBookParams(new URLSearchParams(query));

describe("book list params", () => {
  it("to'g'ri qiymatlarni o'qiydi", () => {
    expect(
      parse("q=%20algebra%20&grade=9&subject=math&status=draft&page=3&ordering=-grade"),
    ).toEqual({
      search: "algebra",
      grade: 9,
      subject: "math",
      status: "draft",
      page: 3,
      ordering: "-grade",
    });
  });

  it("noto'g'ri qiymatlarni tashlaydi", () => {
    expect(parse("grade=12&status=x&page=0&ordering=password")).toEqual({
      search: undefined,
      grade: undefined,
      subject: undefined,
      status: undefined,
      page: undefined,
      ordering: undefined,
    });
  });

  it("serialize bo'sh qiymatlarni va 1-sahifani yozmaydi; round-trip", () => {
    expect(serializeBookParams({ page: 1, search: "" })).toBe("");
    const params = { search: "a b", grade: 5, status: "published", page: 2 } as const;
    expect(parse(serializeBookParams(params))).toMatchObject(params);
  });

  it("filtr o'zgarganda sahifa tashlanadi", () => {
    expect(withFilter({ page: 4, grade: 5 }, { grade: 6 })).toEqual({
      page: undefined,
      grade: 6,
    });
  });
});
