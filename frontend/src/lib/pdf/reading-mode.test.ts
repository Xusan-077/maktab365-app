import { describe, expect, it } from "vitest";
import {
  nextSpread,
  pageAtCenter,
  pageOffsets,
  parseModeParam,
  prevSpread,
  renderWindow,
  resolveMode,
  spreadPages,
  spreadStart,
} from "./reading-mode";

describe("rejim tanlovi", () => {
  it("?mode= faqat h | v", () => {
    expect(parseModeParam("h")).toBe("h");
    expect(parseModeParam(" V ")).toBe("v");
    expect(parseModeParam("x")).toBeNull();
    expect(parseModeParam(null)).toBeNull();
  });
  it("URL > saqlangan > qurilma (desktop — h, mobil — v)", () => {
    expect(resolveMode("v", "h")).toBe("v");
    expect(resolveMode(null, "h")).toBe("h");
    expect(resolveMode(null, null)).toBe("v");
  });
});

describe("yoyma", () => {
  it("1-bet yolg'iz o'ngda, keyin 2–3, 4–5 juft; oxirgi juftsiz bet chapda", () => {
    expect(spreadPages(1, 240, true)).toEqual([null, 1]);
    expect(spreadPages(2, 240, true)).toEqual([2, 3]);
    expect(spreadPages(3, 240, true)).toEqual([2, 3]);
    expect(spreadPages(240, 240, true)).toEqual([240, null]);
    expect(spreadPages(7, 240, false)).toEqual([7]);
  });
  it("yoyma boshi: 33 → 32 (bet raqami saqlanadi, ko'rinish juftga tushadi)", () => {
    expect(spreadStart(33, true)).toBe(32);
    expect(spreadStart(32, true)).toBe(32);
    expect(spreadStart(1, true)).toBe(1);
    expect(spreadStart(33, false)).toBe(33);
  });
  it("yoymada bir bosishda 2 bet; chegaralarda null", () => {
    expect(nextSpread(1, 240, true)).toBe(2);
    expect(nextSpread(3, 240, true)).toBe(4);
    expect(nextSpread(238, 240, true)).toBe(240);
    expect(nextSpread(240, 240, true)).toBeNull();
    expect(prevSpread(5, true)).toBe(2);
    expect(prevSpread(2, true)).toBe(1);
    expect(prevSpread(1, true)).toBeNull();
    expect(nextSpread(5, 240, false)).toBe(6);
    expect(prevSpread(1, false)).toBeNull();
  });
  it("239 betli kitob: oxirgi yoyma 238–239", () => {
    expect(spreadPages(239, 239, true)).toEqual([238, 239]);
    expect(nextSpread(238, 239, true)).toBeNull();
  });
});

describe("vertikal joylashuv", () => {
  const heights = [100, 100, 200, 100];
  const { tops, total } = pageOffsets(heights, 10);
  it("har bet boshi va umumiy balandlik (oraliqlar bilan)", () => {
    expect(tops).toEqual([0, 110, 220, 430]);
    expect(total).toBe(530);
  });
  it("markazga eng yaqin bet", () => {
    expect(pageAtCenter(tops, heights, 0)).toBe(1);
    expect(pageAtCenter(tops, heights, 150)).toBe(2);
    expect(pageAtCenter(tops, heights, 216)).toBe(3); // oraliqda — yaqinrog'i
    expect(pageAtCenter(tops, heights, 212)).toBe(2);
    expect(pageAtCenter(tops, heights, 10_000)).toBe(4);
    expect(pageAtCenter([], [], 50)).toBe(1);
  });
  it("chiziladigan oyna ±radius, chegaralarga qirqilgan", () => {
    expect(renderWindow(1, 240, 2)).toEqual({ from: 1, to: 3 });
    expect(renderWindow(120, 240, 2)).toEqual({ from: 118, to: 122 });
    expect(renderWindow(240, 240, 2)).toEqual({ from: 238, to: 240 });
  });
});
