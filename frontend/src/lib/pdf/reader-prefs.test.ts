import { describe, expect, it } from "vitest";
import {
  DEFAULT_READER_PREFS,
  DOUBLE_TAP_MS,
  isDoubleTap,
  nextTone,
  sanitizePrefs,
} from "./reader-prefs";

describe("reader prefs", () => {
  it("fon rejimlari aylanadi: light → sepia → dark → light", () => {
    expect(nextTone("light")).toBe("sepia");
    expect(nextTone("sepia")).toBe("dark");
    expect(nextTone("dark")).toBe("light");
  });
  it("buzilgan xotira standartga qaytadi", () => {
    expect(sanitizePrefs(null)).toEqual(DEFAULT_READER_PREFS);
    expect(sanitizePrefs({ tone: "neon", mode: "x" })).toEqual(DEFAULT_READER_PREFS);
    // Eski «Surish» (`h`) — «Kitob».
    expect(sanitizePrefs({ tone: "dark", mode: "h" })).toEqual({
      ...DEFAULT_READER_PREFS,
      tone: "dark",
      mode: "b",
    });
    expect(sanitizePrefs({ tone: "sepia", fit: "page", zoom: 1.84, warm: true })).toEqual({
      tone: "sepia",
      mode: null,
      fit: "page",
      zoom: 1.85,
      warm: true,
    });
    expect(sanitizePrefs({ zoom: 9 }).zoom).toBe(3);
    expect(sanitizePrefs({ fit: "zoom", zoom: "2", warm: 1 })).toEqual(DEFAULT_READER_PREFS);
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
