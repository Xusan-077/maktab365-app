import { describe, expect, it } from "vitest";
import { MAX_PIXEL_RATIO, pageCanvasScale } from "./pdf-page";

const A4 = { width: 595, height: 842 };

describe("pageCanvasScale", () => {
  it("CSS eniga moslab masshtab beradi (zichlik 1)", () => {
    expect(pageCanvasScale(A4, 595, 1)).toBeCloseTo(1, 2);
    expect(pageCanvasScale(A4, 297, 1)).toBeCloseTo(0.499, 2);
  });

  it("devicePixelRatio 2 dan oshmaydi (xotira)", () => {
    const at2 = pageCanvasScale(A4, 400, MAX_PIXEL_RATIO);
    const at3 = pageCanvasScale(A4, 400, 3);
    expect(at3).toBe(at2);
    expect(at2).toBeGreaterThan(pageCanvasScale(A4, 400, 1));
  });

  it("kasr piksel eni pastga yaxlitlanadi", () => {
    expect(pageCanvasScale(A4, 400.9, 1)).toBe(pageCanvasScale(A4, 400, 1));
  });
});
