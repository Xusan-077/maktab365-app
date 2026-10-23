// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseSlidesParams,
  readSlidesProgress,
  saveSlidesProgress,
  withSlidesParams,
} from "./slides";

const ID = "3f2b8c1e-5d4a-4c7e-9a10-0b6f1d2e3c4d";
const params = (query: string) => new URLSearchParams(query);

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("parseSlidesParams", () => {
  it("?slides=<uuid>&slide=N ni o'qiydi", () => {
    expect(parseSlidesParams(params(`slides=${ID}&slide=7`))).toEqual({ chapterId: ID, slide: 7 });
  });

  it("aytilmagan yoki yaroqsiz qiymatlar null bo'ladi", () => {
    expect(parseSlidesParams(params(""))).toEqual({ chapterId: null, slide: null });
    expect(parseSlidesParams(params("slides=abc&slide=0"))).toEqual({
      chapterId: null,
      slide: null,
    });
    expect(parseSlidesParams(params(`slides=${ID}&slide=-2`)).slide).toBeNull();
    expect(parseSlidesParams(params(`slides=${ID}&slide=3x`)).slide).toBeNull();
    expect(parseSlidesParams(params(`slides=${ID}`))).toEqual({ chapterId: ID, slide: null });
  });

  it("katta harfli id kichikka keltiriladi", () => {
    expect(parseSlidesParams(params(`slides=${ID.toUpperCase()}`)).chapterId).toBe(ID);
  });
});

describe("withSlidesParams", () => {
  it("berilganlarni almashtiradi, boshqa parametrlar qoladi", () => {
    expect(withSlidesParams(params("page=5&x=1"), { slides: ID, slide: 2 })).toBe(
      `page=5&x=1&slides=${ID}&slide=2`,
    );
  });

  it("null qiymat parametrni olib tashlaydi", () => {
    expect(
      withSlidesParams(params(`page=5&slides=${ID}&slide=2`), { slides: null, slide: null }),
    ).toBe("page=5");
  });

  it("sahifa almashganda ko'rgich parametrlari saqlanadi", () => {
    expect(withSlidesParams(params(`page=5&slides=${ID}&slide=2`), { page: 9 })).toBe(
      `page=9&slides=${ID}&slide=2`,
    );
  });

  it("matn ko'rinishidagi query ham qabul qilinadi", () => {
    expect(withSlidesParams("page=1", { page: 2 })).toBe("page=2");
  });
});

describe("slides progress (localStorage)", () => {
  it("saqlaydi va o'qiydi", () => {
    expect(readSlidesProgress(ID)).toBeNull();
    saveSlidesProgress(ID, 6);
    expect(readSlidesProgress(ID)).toBe(6);
    expect(readSlidesProgress("boshqa")).toBeNull();
  });

  it("buzuq qiymat null qaytaradi", () => {
    window.localStorage.setItem(`maktab365-slides:${ID}`, "abc");
    expect(readSlidesProgress(ID)).toBeNull();
    window.localStorage.setItem(`maktab365-slides:${ID}`, "0");
    expect(readSlidesProgress(ID)).toBeNull();
  });

  it("localStorage yopiq bo'lsa xato bermaydi", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveSlidesProgress(ID, 3)).not.toThrow();
    expect(readSlidesProgress(ID)).toBeNull();
  });
});
