import { describe, expect, it } from "vitest";
import {
  anchorOffset,
  clampZoom,
  doubleTapZoom,
  formatZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  nextZoomStep,
  nudgeZoom,
  pinchZoom,
  wheelZoom,
} from "./zoom";

describe("zoom chegaralari", () => {
  it("50%–300% oralig'ida, 0.05 qadam bilan", () => {
    expect([MIN_ZOOM, MAX_ZOOM]).toEqual([0.5, 3]);
    expect(clampZoom(0.4)).toBe(0.5);
    expect(clampZoom(0.72)).toBe(0.7);
    expect(clampZoom(7)).toBe(3);
    expect(clampZoom(1.234)).toBe(1.25);
    expect(clampZoom(Number.NaN)).toBe(1);
  });
});

describe("pinchZoom", () => {
  it("barmoqlar orasidagi masofa nisbatida", () => {
    expect(pinchZoom(1, 100, 200)).toBe(2);
    expect(pinchZoom(2, 100, 75)).toBe(1.5);
    expect(pinchZoom(2, 100, 400)).toBe(3);
    expect(pinchZoom(1.5, 100, 10)).toBe(0.5);
    expect(pinchZoom(1.5, 0, 50)).toBe(1.5); // boshlang'ich masofa 0 — o'zgarmaydi
  });
});

describe("doubleTapZoom / nextZoomStep", () => {
  it("ikki marta bosish: 1× ↔ 2× (kattalashgan bo'lsa — 1×)", () => {
    expect(doubleTapZoom(1)).toBe(2);
    expect(doubleTapZoom(2)).toBe(1);
    expect(doubleTapZoom(2.6)).toBe(1);
    expect(doubleTapZoom(0.5)).toBe(1); // kichraytirilgan — 100% ga
  });

  it("tugma: 1 → 1.5 → 2 → 3 → 1; oraliq qiymatdan keyingi pog'onaga", () => {
    expect([1, 1.5, 2, 3].map(nextZoomStep)).toEqual([1.5, 2, 3, 1]);
    expect(nextZoomStep(1.7)).toBe(2);
    expect(nextZoomStep(2.95)).toBe(3);
  });

  it("formatZoom — foizda", () => {
    expect(formatZoom(1)).toBe("100%");
    expect(formatZoom(1.5)).toBe("150%");
    expect(formatZoom(0.5)).toBe("50%");
  });

  it("Ctrl+g'ildirak: yuqoriga — kattalashadi, pastga — kichrayadi, chegaralarda to'xtaydi", () => {
    expect(wheelZoom(1, -100)).toBeGreaterThan(1);
    expect(wheelZoom(1, 100)).toBeLessThan(1);
    expect(wheelZoom(3, -500)).toBe(3);
    expect(wheelZoom(0.5, 500)).toBe(0.5);
  });
});

describe("anchorOffset", () => {
  it("zoom o'zgarganda fokus nuqtasi joyida qoladi", () => {
    // 1× da scroll 0, barmoq 100px da → 2× da shu nuqta ham 100px da bo'lishi uchun scroll 100.
    expect(anchorOffset(0, 100, 2)).toBe(100);
    expect(anchorOffset(100, 100, 0.5)).toBe(0);
    expect(anchorOffset(50, 0, 1)).toBe(50);
    expect(anchorOffset(0, 10, 0.5)).toBe(0); // manfiy bo'lmaydi
  });
});

describe("nudgeZoom", () => {
  it("10% qadam, chegaralar ichida", () => {
    expect(nudgeZoom(1, 1)).toBe(1.1);
    expect(nudgeZoom(1.1, -1)).toBe(1);
    expect(nudgeZoom(1.23, 1)).toBe(1.3);
    expect(nudgeZoom(2.9, 1)).toBe(3);
    expect(nudgeZoom(3, 1)).toBe(3);
    expect(nudgeZoom(0.5, -1)).toBe(0.5);
  });
});
