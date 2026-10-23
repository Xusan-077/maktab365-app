import { describe, expect, it } from "vitest";
import { parseUserParams, serializeUserParams, withUserFilter } from "./user-params";

const raw = (query: string) => parseUserParams(new URLSearchParams(query));

describe("parseUserParams", () => {
  it("to'g'ri qiymatlarni o'qiydi", () => {
    expect(raw("q=%20ali%20&role=teacher&status=blocked&page=3")).toEqual({
      search: "ali",
      role: "teacher",
      status: "blocked",
      page: 3,
    });
  });

  it("noto'g'ri qiymatlarni tashlaydi", () => {
    expect(raw("role=root&status=x&page=0&q=%20")).toEqual({
      search: undefined,
      role: undefined,
      status: undefined,
      page: undefined,
    });
    expect(raw("page=abc").page).toBeUndefined();
    expect(raw("page=-2").page).toBeUndefined();
  });
});

describe("serializeUserParams", () => {
  it("bo'sh qiymatlar va 1-sahifa yozilmaydi", () => {
    expect(serializeUserParams({ page: 1 })).toBe("");
    expect(serializeUserParams({ search: "ali", role: "admin", status: "active", page: 2 })).toBe(
      "q=ali&role=admin&status=active&page=2",
    );
  });

  it("parse bilan aylanma mos keladi", () => {
    const params = { search: "vali", role: "editor" as const, page: 4 };
    expect(raw(serializeUserParams(params))).toMatchObject(params);
  });
});

describe("withUserFilter", () => {
  it("filtr o'zgarganda sahifa 1 ga qaytadi", () => {
    expect(withUserFilter({ page: 5, role: "admin" }, { status: "blocked" })).toEqual({
      page: undefined,
      role: "admin",
      status: "blocked",
    });
  });
});
