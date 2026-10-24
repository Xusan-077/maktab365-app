import { describe, expect, it } from "vitest";
import {
  parseBookParams,
  parseSupportParams,
  serializeBookParams,
  serializeSupportParams,
  withFilter,
} from "./list-params";

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

describe("parseSupportParams / serializeSupportParams", () => {
  const BOOK = "3f2b8c1e-5d4a-4c7e-9a10-0b6f1d2e3c4d";

  it("yaroqli filtrlar o'qiladi, yaroqsizlari tashlanadi", () => {
    const params = new URLSearchParams(`holat=resolved&tur=content_error&kitob=${BOOK}&page=3`);
    expect(parseSupportParams(params)).toEqual({
      page: 3,
      status: "resolved",
      kind: "content_error",
      pdfBook: BOOK,
    });
    expect(parseSupportParams(new URLSearchParams("holat=x&tur=y&kitob=z&page=0"))).toEqual({
      page: undefined,
      status: undefined,
      kind: undefined,
      pdfBook: undefined,
    });
  });

  it("qaytib URL'ga (1-sahifa yozilmaydi)", () => {
    expect(serializeSupportParams({ status: "new", pdfBook: BOOK, page: 1 })).toBe(
      `holat=new&kitob=${BOOK}`,
    );
    expect(serializeSupportParams({})).toBe("");
  });
});
