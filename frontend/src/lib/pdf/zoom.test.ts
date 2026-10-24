import { describe, expect, it } from "vitest";
import {
  anchorOffset,
  clampZoom,
  doubleTapZoom,
  formatZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  nextZoomStep,
  pinchZoom,
  visibleCount,
} from "./zoom";

describe("zoom chegaralari", () => {
  it("1×–3× oralig'ida, 0.05 qadam bilan", () => {
    expect([MIN_ZOOM, MAX_ZOOM]).toEqual([1, 3]);
    expect(clampZoom(0.4)).toBe(1);
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
    expect(pinchZoom(1.5, 100, 10)).toBe(1);
    expect(pinchZoom(1.5, 0, 50)).toBe(1.5); // boshlang'ich masofa 0 — o'zgarmaydi
  });
});

describe("doubleTapZoom / nextZoomStep", () => {
  it("ikki marta bosish: 1× ↔ 2× (kattalashgan bo'lsa — 1×)", () => {
    expect(doubleTapZoom(1)).toBe(2);
    expect(doubleTapZoom(2)).toBe(1);
    expect(doubleTapZoom(2.6)).toBe(1);
  });

  it("tugma: 1 → 1.5 → 2 → 3 → 1; oraliq qiymatdan keyingi pog'onaga", () => {
    expect([1, 1.5, 2, 3].map(nextZoomStep)).toEqual([1.5, 2, 3, 1]);
    expect(nextZoomStep(1.7)).toBe(2);
    expect(nextZoomStep(2.95)).toBe(3);
  });

  it("formatZoom", () => {
    expect(formatZoom(1)).toBe("1×");
    expect(formatZoom(1.5)).toBe("1.5×");
    expect(formatZoom(2.25)).toBe("2.3×");
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

describe("visibleCount", () => {
  it("hammasi sig'sa — hammasi, aks holda «⋯» uchun joy qoldiriladi", () => {
    expect(visibleCount(8, 8 * 46, 46)).toBe(8);
    expect(visibleCount(8, 8 * 46 - 1, 46)).toBe(6); // 7 ta + «⋯» sig'maydi
    expect(visibleCount(8, 200, 46)).toBe(3);
    expect(visibleCount(8, 30, 46)).toBe(0);
    expect(visibleCount(0, 500, 46)).toBe(0);
  });
});
