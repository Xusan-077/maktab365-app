import { describe, expect, it } from "vitest";
import { analyzeQuadratic, formatNumber } from "./quadratic-math";

describe("analyzeQuadratic", () => {
  it("x² − 5x + 6: ildizlar 2 va 3, Viyet munosabatlari", () => {
    const result = analyzeQuadratic(1, -5, 6);
    expect(result.roots).toEqual([2, 3]);
    expect(result.rootSum).toBe(5);
    expect(result.rootProduct).toBe(6);
    expect(result.equation).toBe("y = x² − 5x + 6");
  });

  it("ildiz yo'q (D < 0) va bitta ildiz (D = 0)", () => {
    expect(analyzeQuadratic(1, 0, 1).roots).toEqual([]);
    expect(analyzeQuadratic(1, -2, 1).roots).toEqual([1]);
  });

  it("a = 0 bo'lsa parabola emas", () => {
    expect(analyzeQuadratic(0, 2, 1).degenerate).toBe(true);
  });
});

describe("formatNumber", () => {
  it("yaxlitlaydi va -0 ni 0 qiladi", () => {
    expect(formatNumber(1.005)).toBe("1");
    expect(formatNumber(-0.001)).toBe("0");
    expect(formatNumber(-2.5)).toBe("−2.5");
  });
});
