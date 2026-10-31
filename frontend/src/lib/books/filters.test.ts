import { describe, expect, it } from "vitest";
import {
  activeBookFilterCount,
  bookQuery,
  booksHref,
  EMPTY_BOOK_FILTERS,
  parseBookFilters,
} from "./filters";

describe("parseBookFilters", () => {
  it("URL qiymatlarini filtrlarga o'giradi", () => {
    expect(
      parseBookFilters({ tur: "badiiy", sinf: "7", til: "ru", q: " Navoiy ", bet: "3" }),
    ).toEqual({ type: "fiction", grade: 7, language: "ru", q: "Navoiy", page: 3 });
  });

  it("noto'g'ri qiymatlarni jimgina tashlaydi", () => {
    expect(parseBookFilters({ tur: "x", sinf: "99", til: "de", bet: "0" })).toEqual({
      type: undefined,
      grade: undefined,
      language: undefined,
      q: undefined,
      page: 1,
    });
    expect(parseBookFilters({ sinf: "abc", bet: "-2" }).page).toBe(1);
  });

  it("takrorlangan parametrda birinchisini oladi va qidiruvni qisqartiradi", () => {
    expect(parseBookFilters({ tur: ["test", "math"] }).type).toBe("test");
    expect(parseBookFilters({ q: "a".repeat(300) }).q).toHaveLength(100);
  });
});

describe("bookQuery / booksHref", () => {
  it("kanonik tartibda yig'adi, standart qiymatlarni tushirib qoldiradi", () => {
    expect(bookQuery({ type: "math", grade: 5, language: "uz", q: "IDC", page: 2 })).toBe(
      "tur=matematika&sinf=5&til=uz&q=IDC&bet=2",
    );
    expect(bookQuery(EMPTY_BOOK_FILTERS)).toBe("");
  });

  it("filtr o'zgarsa sahifa 1 ga qaytadi, sahifa o'zgarsa saqlanadi", () => {
    const filters = { type: "fiction" as const, page: 4 };
    expect(booksHref("/kitoblar", filters, { grade: 6 })).toBe("/kitoblar?tur=badiiy&sinf=6");
    expect(booksHref("/kitoblar", filters, { page: 5 })).toBe("/kitoblar?tur=badiiy&bet=5");
    expect(booksHref("/kitoblar", filters, { type: undefined })).toBe("/kitoblar");
  });

  it("faol filtrlarni sanaydi (tur hisobga olinmaydi: u tab)", () => {
    expect(activeBookFilterCount({ type: "test", grade: 3, q: "x", page: 1 })).toBe(2);
  });
});
