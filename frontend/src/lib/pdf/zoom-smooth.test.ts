import { describe, expect, it } from "vitest";
import { clampZoomSmooth, wheelZoomSmooth } from "./zoom";

describe("uzluksiz zoom", () => {
  it("mayda g'ildirak qadamlari to'planadi (0.05 ga yaxlitlanib qotib qolmaydi)", () => {
    let zoom = 1;
    for (let i = 0; i < 40; i += 1) zoom = clampZoomSmooth(wheelZoomSmooth(zoom, -3), 1, 3);
    expect(zoom).toBeGreaterThan(1.25);
    expect(zoom).toBeLessThan(1.35);
  });

  it("chegaralardan chiqmaydi va yaroqsiz qiymatda 1 ga qaytadi", () => {
    expect(clampZoomSmooth(9, 1, 3)).toBe(3);
    expect(clampZoomSmooth(0.2, 1, 3)).toBe(1);
    expect(clampZoomSmooth(Number.NaN, 1, 3)).toBe(1);
  });

  it("qatorlar rejimidagi g'ildirak (Firefox) pikselga keltiriladi", () => {
    expect(wheelZoomSmooth(1, -1, 1)).toBeCloseTo(wheelZoomSmooth(1, -16, 0));
  });
});
