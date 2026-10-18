import { describe, expect, it } from "vitest";
import { analyzeTriangle, clampToGrid, GRID_SIZE, squaredDistance } from "./geometry-math";

describe("squaredDistance", () => {
  it("3-4-5 uchburchakda 25", () => {
    expect(squaredDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
  });
});

describe("clampToGrid", () => {
  it("yaxlitlaydi va to'r chegarasida ushlab turadi", () => {
    expect(clampToGrid(2.6)).toBe(3);
    expect(clampToGrid(-4)).toBe(0);
    expect(clampToGrid(99)).toBe(GRID_SIZE);
  });
});

describe("analyzeTriangle", () => {
  const tri = (...p: [number, number][]) =>
    analyzeTriangle(p.map(([x, y]) => ({ x, y })) as Parameters<typeof analyzeTriangle>[0]);

  it("to'g'ri burchakli (3-4-5) va Pifagor yig'indisi", () => {
    const result = tri([0, 0], [3, 0], [0, 4]);
    expect(result.angleKind).toBe("right");
    expect(result.pythagoras).toEqual({ legs: [9, 16], hypotenuse: 25 });
    expect(result.lengths[1]).toBe(5);
  });

  it("o'tkir va o'tmas burchakli", () => {
    expect(tri([0, 0], [4, 0], [2, 3]).angleKind).toBe("acute");
    expect(tri([0, 0], [6, 0], [1, 1]).angleKind).toBe("obtuse");
  });

  it("teng yonli va turli tomonli", () => {
    expect(tri([0, 0], [4, 0], [2, 3]).sideKind).toBe("isosceles");
    expect(tri([0, 0], [3, 0], [0, 4]).sideKind).toBe("scalene");
  });

  it("bir to'g'ri chiziqdagi nuqtalar degenerat", () => {
    const result = tri([0, 0], [1, 1], [2, 2]);
    expect(result.angleKind).toBe("degenerate");
    expect(result.sideKind).toBeNull();
    expect(result.pythagoras).toBeNull();
  });
});
