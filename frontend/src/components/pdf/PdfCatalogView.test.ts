import { describe, expect, it } from "vitest";
import { parsePdfFilters, serializePdfFilters } from "./PdfCatalogView";

const parse = (query: string) => parsePdfFilters(new URLSearchParams(query));

describe("PDF katalog filtrlari", () => {
  it("URL'dan sinf, fan, qidiruv va sahifani o'qiydi", () => {
    expect(parse("grade=9&subject=algebra&q=%20viyet%20&page=3")).toEqual({
      grade: 9,
      subject: "algebra",
      q: "viyet",
      page: 3,
    });
  });

  it("noto'g'ri qiymatlarni tashlaydi", () => {
    expect(parse("grade=12&page=1&q=")).toEqual({
      grade: undefined,
      subject: undefined,
      q: undefined,
      page: undefined,
    });
    expect(parse("grade=abc&page=-2").grade).toBeUndefined();
  });

  it("filtrlarni URL'ga qaytaradi: bo'sh qiymat va 1-sahifa yozilmaydi", () => {
    expect(serializePdfFilters({ grade: 9, subject: "algebra", q: "viyet", page: 2 })).toBe(
      "grade=9&subject=algebra&q=viyet&page=2",
    );
    expect(serializePdfFilters({ page: 1 })).toBe("");
  });
});
