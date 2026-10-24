import { describe, expect, it } from "vitest";
import { pageWindow, readPercent } from "./page-window";

describe("pageWindow", () => {
  it("bitta sahifa — tugma yo'q", () => {
    expect(pageWindow(1, 1)).toEqual([]);
  });
  it("kam sahifa — hammasi", () => {
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });
  it("boshida: 1 2 3 … N", () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, "gap", 10]);
  });
  it("o'rtada: 1 … 4 5 6 … 10", () => {
    expect(pageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
  });
  it("oxirida: 1 … 8 9 10", () => {
    expect(pageWindow(10, 10)).toEqual([1, "gap", 8, 9, 10]);
  });
  it("bitta sahifalik tirqish raqam bilan to'ldiriladi", () => {
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("readPercent", () => {
  it("foizni chegaralaydi", () => {
    expect(readPercent(45, 160)).toBe(28);
    expect(readPercent(200, 160)).toBe(100);
    expect(readPercent(0, 0)).toBe(0);
  });
});
