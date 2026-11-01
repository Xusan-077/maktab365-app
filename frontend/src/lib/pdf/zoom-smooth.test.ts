import { describe, expect, it } from "vitest";
import { clampZoomSmooth, isDiscreteWheel, wheelZoomSmooth, ZOOM_SENSITIVITY } from "./zoom";

describe("uzluksiz zoom", () => {
  it("mayda (trackpad) qadamlar to'planadi: 0.05 ga yaxlitlanib qotib qolmaydi", () => {
    let zoom = 1;
    for (let i = 0; i < 40; i += 1) zoom = clampZoomSmooth(wheelZoomSmooth(zoom, -3), 1, 3);
    // exp(3 × 40 × 0.0045) ≈ 1.72 — oldingi koeffitsientdan (≈1.30) taxminan 2 baravar tez.
    expect(zoom).toBeCloseTo(Math.exp(120 * ZOOM_SENSITIVITY.trackpad), 6);
    expect(zoom).toBeGreaterThan(1.6);
  });

  it("chegaralardan chiqmaydi va yaroqsiz qiymatda 1 ga qaytadi", () => {
    expect(clampZoomSmooth(9, 1, 3)).toBe(3);
    expect(clampZoomSmooth(0.2, 1, 3)).toBe(1);
    expect(clampZoomSmooth(Number.NaN, 1, 3)).toBe(1);
  });

  it("qadam deltaY ga mutanosib: exp(−deltaY × k), ikki baravar delta — kvadrat", () => {
    const one = wheelZoomSmooth(1, -2);
    expect(wheelZoomSmooth(1, -4)).toBeCloseTo(one * one, 10);
    expect(wheelZoomSmooth(1, 2)).toBeCloseTo(1 / one, 10);
  });

  it("sichqoncha g'ildiragi (diskret 100 px) va trackpad (mayda) — alohida koeffitsient", () => {
    expect(isDiscreteWheel(100)).toBe(true);
    expect(isDiscreteWheel(-120)).toBe(true);
    expect(isDiscreteWheel(3)).toBe(false);
    expect(isDiscreteWheel(41.5)).toBe(false);
    // Bir qadam ≈ ×1.39 (oldin ×1.25).
    expect(wheelZoomSmooth(1, -100)).toBeCloseTo(Math.exp(100 * ZOOM_SENSITIVITY.mouseWheel), 10);
    expect(wheelZoomSmooth(1, -100)).toBeGreaterThan(1.35);
  });

  it("qatorlar rejimidagi g'ildirak (Firefox) — diskret qadam, pikselga keltiriladi", () => {
    expect(isDiscreteWheel(-3, 1)).toBe(true);
    expect(wheelZoomSmooth(1, -3, 1)).toBeCloseTo(Math.exp(48 * ZOOM_SENSITIVITY.mouseWheel), 10);
  });

  it("bitta hodisada sakrash cheklangan (tez aylantirilgan g'ildirak)", () => {
    expect(wheelZoomSmooth(1, -1000)).toBeCloseTo(
      wheelZoomSmooth(1, -ZOOM_SENSITIVITY.maxDeltaPx),
      10,
    );
  });
});
