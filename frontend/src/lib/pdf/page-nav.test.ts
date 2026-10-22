import { describe, expect, it } from "vitest";
import { clampPage, parsePageInput, parsePageParam } from "./page-nav";

describe("clampPage", () => {
  it.each([
    [5, 10, 5],
    [0, 10, 1],
    [-4, 10, 1],
    [11, 10, 10],
    [3.9, 10, 3],
    [Number.NaN, 10, 1],
    [5, 0, 1],
  ])("clampPage(%s, %s) = %s", (value, total, expected) => {
    expect(clampPage(value, total)).toBe(expected);
  });
});

describe("parsePageParam", () => {
  it("raqamni 1..N ga tuzatadi", () => {
    expect(parsePageParam("12", 240)).toBe(12);
    expect(parsePageParam("0", 240)).toBe(1);
    expect(parsePageParam("999", 240)).toBe(240);
  });

  it("aytilmagan yoki yaroqsiz qiymat null", () => {
    expect(parsePageParam(null, 240)).toBeNull();
    expect(parsePageParam(undefined, 240)).toBeNull();
    expect(parsePageParam("", 240)).toBeNull();
    expect(parsePageParam("abc", 240)).toBeNull();
    expect(parsePageParam("12abc", 240)).toBeNull();
    expect(parsePageParam("-3", 240)).toBeNull();
    expect(parsePageParam("1.5", 240)).toBeNull();
  });
});

describe("parsePageInput", () => {
  it("to'g'ri qiymatni qabul qiladi", () => {
    expect(parsePageInput(" 7 ", 1, 20)).toBe(7);
  });

  it("chegaradan tashqarini tuzatadi", () => {
    expect(parsePageInput("0", 5, 20)).toBe(1);
    expect(parsePageInput("-2", 5, 20)).toBe(1);
    expect(parsePageInput("999", 5, 20)).toBe(20);
  });

  it("bo'sh yoki raqam bo'lmasa joriy sahifa qoladi", () => {
    expect(parsePageInput("", 5, 20)).toBe(5);
    expect(parsePageInput("abc", 5, 20)).toBe(5);
    expect(parsePageInput("3.5", 5, 20)).toBe(5);
  });
});
