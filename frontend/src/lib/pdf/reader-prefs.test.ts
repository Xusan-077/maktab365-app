import { describe, expect, it } from "vitest";
import {
  DEFAULT_READER_PREFS,
  DOUBLE_TAP_MS,
  isDoubleTap,
  nextFit,
  nextTone,
  sanitizePrefs,
} from "./reader-prefs";

describe("reader prefs", () => {
  it("fon rejimlari aylanadi: light → sepia → dark → light", () => {
    expect(nextTone("light")).toBe("sepia");
    expect(nextTone("sepia")).toBe("dark");
    expect(nextTone("dark")).toBe("light");
  });
  it("moslash almashadi", () => {
    expect(nextFit("width")).toBe("page");
    expect(nextFit("page")).toBe("width");
  });
  it("buzilgan xotira standartga qaytadi", () => {
    expect(sanitizePrefs(null)).toEqual(DEFAULT_READER_PREFS);
    expect(sanitizePrefs({ tone: "neon", fit: 3 })).toEqual(DEFAULT_READER_PREFS);
    expect(sanitizePrefs({ tone: "dark", fit: "page" })).toEqual({ tone: "dark", fit: "page" });
  });
});

describe("isDoubleTap", () => {
  const first = { x: 100, y: 100, at: 1000 };
  it("tez va yaqin bosish — ikki marta bosish", () => {
    expect(isDoubleTap(first, { x: 110, y: 105, at: 1000 + DOUBLE_TAP_MS - 1 })).toBe(true);
  });
  it("sekin yoki uzoq bosish emas; birinchi bosishda false", () => {
    expect(isDoubleTap(first, { x: 100, y: 100, at: 1000 + DOUBLE_TAP_MS + 1 })).toBe(false);
    expect(isDoubleTap(first, { x: 300, y: 100, at: 1100 })).toBe(false);
    expect(isDoubleTap(null, first)).toBe(false);
  });
});
