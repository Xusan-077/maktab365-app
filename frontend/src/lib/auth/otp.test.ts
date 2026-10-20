import { describe, expect, it } from "vitest";
import { applyBackspace, applyInput, codeOf, emptyCells, isComplete, OTP_LENGTH } from "./otp";

describe("applyInput", () => {
  it("bitta raqam: shu katak, fokus keyingisiga", () => {
    const { cells, focus } = applyInput(emptyCells(), 0, "4");
    expect(cells[0]).toBe("4");
    expect(focus).toBe(1);
  });

  it("raqam bo'lmagan belgi e'tiborsiz", () => {
    const start = emptyCells();
    expect(applyInput(start, 2, "a")).toEqual({ cells: start, focus: 2 });
  });

  it("qo'yish: raqamlar keyingi kataklarga yoyiladi, bo'shliq va tire tashlanadi", () => {
    const { cells, focus } = applyInput(emptyCells(), 0, "123 456");
    expect(codeOf(cells)).toBe("123456");
    expect(focus).toBe(OTP_LENGTH - 1);
    expect(isComplete(cells)).toBe(true);
  });

  it("o'rtadan qo'yilganda ortiqchasi kesiladi", () => {
    const { cells } = applyInput(emptyCells(), 4, "98765");
    expect(cells.slice(4)).toEqual(["9", "8"]);
    expect(cells.slice(0, 4)).toEqual(["", "", "", ""]);
  });

  it("oxirgi katakda fokus chegaradan chiqmaydi", () => {
    expect(applyInput(emptyCells(), 5, "7").focus).toBe(5);
  });
});

describe("applyBackspace", () => {
  it("to'la katakni tozalaydi, fokus o'sha yerda", () => {
    const cells = ["1", "2", "", "", "", ""];
    expect(applyBackspace(cells, 1)).toEqual({ cells: ["1", "", "", "", "", ""], focus: 1 });
  });

  it("bo'sh katakda oldingisini tozalab, orqaga o'tadi", () => {
    const cells = ["1", "2", "", "", "", ""];
    expect(applyBackspace(cells, 2)).toEqual({ cells: ["1", "", "", "", "", ""], focus: 1 });
  });

  it("birinchi katakda joyida qoladi", () => {
    expect(applyBackspace(emptyCells(), 0).focus).toBe(0);
  });
});
