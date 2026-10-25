import { describe, expect, it } from "vitest";
import type { AnnotationRect } from "./annotations";
import { menuPosition, selectionRects } from "./selection";

const box = { left: 100, top: 50, width: 400, height: 600 };

function expectRect(actual: AnnotationRect, expected: AnnotationRect) {
  for (const key of ["x", "y", "w", "h"] as const) expect(actual[key]).toBeCloseTo(expected[key]);
}

describe("selectionRects", () => {
  it("bet qutisiga nisbatan 0..1; bo'sh rect'lar tashlanadi", () => {
    const rects = selectionRects(
      [
        { left: 140, top: 110, width: 80, height: 12 },
        { left: 0, top: 0, width: 0, height: 0 },
      ],
      box,
    );
    expect(rects).toHaveLength(1);
    expectRect(rects[0], { x: 0.1, y: 0.1, w: 0.2, h: 0.02 });
  });

  it("bir qatordagi tutash bo'laklar birlashadi, keyingi qator alohida", () => {
    const rects = selectionRects(
      [
        { left: 140, top: 110, width: 40, height: 12 },
        { left: 180, top: 110, width: 40, height: 12 },
        { left: 100, top: 130, width: 100, height: 12 },
      ],
      box,
    );
    expect(rects).toHaveLength(2);
    expect(rects[0].w).toBeCloseTo(0.2);
  });

  it("qutidan chiqqan qism qirqiladi; qutisiz natija bo'sh", () => {
    expectRect(selectionRects([{ left: 450, top: 600, width: 200, height: 100 }], box)[0], {
      x: 0.875,
      y: 550 / 600,
      w: 0.125,
      h: 50 / 600,
    });
    expect(
      selectionRects([{ left: 1, top: 1, width: 5, height: 5 }], { ...box, width: 0 }),
    ).toEqual([]);
  });
});

describe("menuPosition", () => {
  const menu = { width: 200, height: 44, gap: 8, minTop: 72 };
  const viewport = { width: 400, height: 800 };
  it("belgilash ustida, markazda", () => {
    expect(menuPosition({ left: 100, top: 300, width: 100, height: 20 }, viewport, menu)).toEqual({
      top: 248,
      left: 50,
    });
  });
  it("tepada joy yo'q — ostida; chetdan chiqmaydi", () => {
    expect(menuPosition({ left: 380, top: 80, width: 10, height: 20 }, viewport, menu)).toEqual({
      top: 108,
      left: 192,
    });
  });
});
