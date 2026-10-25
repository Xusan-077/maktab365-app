import { describe, expect, it } from "vitest";
import {
  affineFrom,
  clampCorner,
  clipHalfPlane,
  cornerPath,
  curlGeometry,
  flapLocalClip,
  flapTransform,
  polygonCss,
  reflect,
} from "./page-curl";

const W = 400;
const H = 560;

const area = (polygon: { x: number; y: number }[]) =>
  Math.abs(
    polygon.reduce((sum, point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );

describe("curl geometriyasi", () => {
  it("burchak joyida — buklanish yo'q", () => {
    expect(curlGeometry(W, H, "bottom", { x: W, y: H })).toBeNull();
  });

  it("old bet + buklangan qism = butun varaq; buklangan qism aks ettirilgan", () => {
    const geometry = curlGeometry(W, H, "bottom", { x: 200, y: 460 })!;
    expect(area(geometry.front) + area(geometry.cut)).toBeCloseTo(W * H, 3);
    // Aks ettirish yuzani saqlaydi, burchak P ga tushadi.
    expect(area(geometry.flap)).toBeCloseTo(area(geometry.cut), 3);
    const corner = reflect({ x: W, y: H }, geometry.origin, geometry.normal);
    expect(corner.x).toBeCloseTo(200, 6);
    expect(corner.y).toBeCloseTo(460, 6);
    expect(geometry.progress).toBeCloseTo(0.25, 6);
  });

  it("to'liq ag'darilgan (burchak −W da): orqa bet transformi — o'z joyi (birlik)", () => {
    const geometry = curlGeometry(W, H, "bottom", { x: -W, y: H })!;
    const [a, b, c, d, e, f] = flapTransform(geometry, W);
    expect([a, b, c, d].map((value) => Math.round(value * 1e6) / 1e6)).toEqual([1, 0, 0, 1]);
    expect(Math.abs(e)).toBeLessThan(1e-6);
    expect(Math.abs(f)).toBeLessThan(1e-6);
    expect(geometry.progress).toBe(1);
    expect(area(geometry.front)).toBeCloseTo(0, 3);
  });

  it("orqa bet chegarasi mahalliy koordinatada (u = W − x)", () => {
    const geometry = curlGeometry(W, H, "top", { x: 300, y: 40 })!;
    const local = flapLocalClip(geometry, W);
    expect(local).toHaveLength(geometry.cut.length);
    local.forEach((point, index) => expect(point.x).toBeCloseTo(W - geometry.cut[index].x, 9));
  });

  it("burchak varaqdan uzilib ketmaydi (umurtqadan ≤ W)", () => {
    const point = clampCorner({ x: -900, y: H }, W, H, "bottom");
    expect(Math.hypot(point.x, point.y - H)).toBeCloseTo(W, 6);
    const inside = clampCorner({ x: 100, y: 500 }, W, H, "bottom");
    expect(inside).toEqual({ x: 100, y: 500 });
  });
});

describe("yordamchilar", () => {
  it("yarim tekislik bo'yicha kesish", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const half = clipHalfPlane(square, { x: 5, y: 0 }, { x: 1, y: 0 }, 1);
    expect(area(half)).toBeCloseTo(50, 6);
  });

  it("affin matritsa uch nuqtadan", () => {
    const matrix = affineFrom(({ x, y }) => ({ x: 2 * x + 5, y: -y + 1 }));
    expect(matrix.map((value) => value + 0)).toEqual([2, 0, 0, -1, 5, 1]);
  });

  it("CSS polygon (bo'sh ko'pburchak — hech narsa ko'rinmaydi)", () => {
    expect(polygonCss([])).toBe("polygon(0 0, 0 0, 0 0)");
    expect(
      polygonCss(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 2 },
        ],
        10,
      ),
    ).toBe("polygon(10.00px 0.00px, 11.00px 0.00px, 11.00px 2.00px)");
  });

  it("avtomatik yo'l: boshlanish va oxiri aniq, o'rtada burchak ko'tariladi", () => {
    const from = { x: W, y: H };
    const to = { x: -W, y: H };
    expect(cornerPath(from, to, -60, 0)).toEqual(from);
    const end = cornerPath(from, to, -60, 1);
    expect(end.x).toBe(-W);
    expect(end.y).toBeCloseTo(H, 6);
    expect(cornerPath(from, to, -60, 0.5).y).toBeCloseTo(H - 60, 6);
  });
});
