/**
 * Varaq ag'darish ("curl") geometriyasi (sof funksiyalar). Varaq koordinatalari: umurtqa x = 0,
 * varaq x ∈ [0, W], y ∈ [0, H] da yotadi (o'ng bet). Sudralgan burchak `P` — varaq burchagining
 * hozirgi joyi; buklanish chizig'i — asl burchak `C` va `P` orasidagi kesmaning o'rta
 * perpendikulyari. Chiziqning burchak tomonidagi qismi buklanib (aks ettirilib) orqa betni
 * ko'rsatadi, ostidan keyingi bet ochiladi.
 */

export interface Point {
  x: number;
  y: number;
}
export type Polygon = Point[];
export type Corner = "top" | "bottom";

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const length = (a: Point) => Math.hypot(a.x, a.y);

/** Burchakning asl (tekis varaqdagi) joyi. */
export const cornerPoint = (width: number, height: number, corner: Corner): Point => ({
  x: width,
  y: corner === "top" ? 0 : height,
});

/**
 * Burchak varaqdan "uzilib" ketmasin: umurtqadagi shu tomon nuqtasidan ≤ W va qarama-qarshi
 * umurtqa uchidan ≤ diagonal masofada (qog'oz cho'zilmaydi).
 */
export function clampCorner(point: Point, width: number, height: number, corner: Corner): Point {
  const cornerY = corner === "top" ? 0 : height;
  let p = point;
  const near = { x: 0, y: cornerY };
  const toNear = length(sub(p, near));
  if (toNear > width) p = add(near, mul(sub(p, near), width / toNear));
  const far = { x: 0, y: height - cornerY };
  const diagonal = Math.hypot(width, height);
  const toFar = length(sub(p, far));
  if (toFar > diagonal) p = add(far, mul(sub(p, far), diagonal / toFar));
  return p;
}

/** Sutherland–Hodgman: ko'pburchakning `(s − origin)·normal · sign ≥ 0` yarim tekislikdagi qismi. */
export function clipHalfPlane(
  polygon: Polygon,
  origin: Point,
  normal: Point,
  sign: 1 | -1,
): Polygon {
  const side = (point: Point) => sign * dot(sub(point, origin), normal);
  const out: Polygon = [];
  polygon.forEach((current, index) => {
    const next = polygon[(index + 1) % polygon.length];
    const a = side(current);
    const b = side(next);
    if (a >= 0) out.push(current);
    if (a >= 0 !== b >= 0) {
      const t = a / (a - b);
      out.push(add(current, mul(sub(next, current), t)));
    }
  });
  return out;
}

export interface CurlGeometry {
  /** Buklanish chizig'idagi nuqta (C va P o'rtasi) va burchak tomonga qaragan birlik normal. */
  origin: Point;
  normal: Point;
  /** Old bet (varaqning umurtqa tomonidagi tekis qismi). */
  front: Polygon;
  /** Varaqning buklangan qismi (aks ettirishdan oldin) — shu joyda ostidagi bet ochiladi. */
  cut: Polygon;
  /** Buklangan qism ekrandagi joyi (aks ettirilgan). */
  flap: Polygon;
  /** 0 — tekis, 1 — to'liq ag'darilgan (burchak x bo'yicha). */
  progress: number;
}

/** Nuqtani buklanish chizig'iga nisbatan aks ettiradi. */
export function reflect(point: Point, origin: Point, normal: Point): Point {
  return sub(point, mul(normal, 2 * dot(sub(point, origin), normal)));
}

/** `P` burchakdagi varaq geometriyasi; burchak deyarli joyida bo'lsa — `null` (buklanish yo'q). */
export function curlGeometry(
  width: number,
  height: number,
  corner: Corner,
  point: Point,
): CurlGeometry | null {
  const start = cornerPoint(width, height, corner);
  const delta = sub(start, point);
  const distance = length(delta);
  if (distance < 0.5 || width <= 0 || height <= 0) return null;
  const normal = mul(delta, 1 / distance);
  const origin = mul(add(start, point), 0.5);
  const rect: Polygon = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const cut = clipHalfPlane(rect, origin, normal, 1);
  return {
    origin,
    normal,
    front: clipHalfPlane(rect, origin, normal, -1),
    cut,
    flap: cut.map((vertex) => reflect(vertex, origin, normal)),
    progress: Math.min(1, Math.max(0, (width - point.x) / (2 * width))),
  };
}

/** CSS `matrix(a, b, c, d, e, f)` qiymatlari. */
export type Affine = [number, number, number, number, number, number];

/** Affin akslantirish uch nuqtadan: `map(0,0)`, `map(1,0)`, `map(0,1)`. */
export function affineFrom(map: (point: Point) => Point): Affine {
  const o = map({ x: 0, y: 0 });
  const ex = sub(map({ x: 1, y: 0 }), o);
  const ey = sub(map({ x: 0, y: 1 }), o);
  return [ex.x, ex.y, ey.x, ey.y, o.x, o.y];
}

/**
 * Orqa bet (keyingi yoymaning chap beti) transformi: element o'z joyida (umurtqadan chapda,
 * `[−W, 0]`) turibdi deb, mahalliy `(u, v)` → varaq nuqtasi `(W − u, v)` → aks ettirilgan joy.
 * Natija — CSS `matrix()` (transform-origin `0 0`), elementning o'z joyiga nisbatan.
 */
export function flapTransform(geometry: CurlGeometry, width: number): Affine {
  return affineFrom(({ x: u, y: v }) => {
    const shown = reflect({ x: width - u, y: v }, geometry.origin, geometry.normal);
    // Element chap betda turibdi: uning (0,0) nuqtasi umurtqadan W chapda.
    return { x: shown.x + width, y: shown.y };
  });
}

/** Buklangan qismning orqa bet elementidagi (mahalliy) chegarasi. */
export const flapLocalClip = (geometry: CurlGeometry, width: number): Polygon =>
  geometry.cut.map(({ x, y }) => ({ x: width - x, y }));

/** CSS `clip-path: polygon(...)` (px, `dx` siljish bilan). Bo'sh ko'pburchak — hech narsa ko'rinmaydi. */
export function polygonCss(polygon: Polygon, dx = 0): string {
  if (polygon.length < 3) return "polygon(0 0, 0 0, 0 0)";
  return `polygon(${polygon
    .map(({ x, y }) => `${(x + dx).toFixed(2)}px ${y.toFixed(2)}px`)
    .join(", ")})`;
}

/** Silliq boshlanish/tugash (ease-in-out cubic). */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Avtomatik ag'darish yo'li: burchak `from` dan `to` ga, yo'lda biroz ko'tariladi (`lift` px —
 * pastki burchak uchun manfiy, ya'ni yuqoriga), shunda varaq tekis emas, "egilib" o'tadi.
 */
export function cornerPath(from: Point, to: Point, lift: number, t: number): Point {
  const e = easeInOut(Math.min(1, Math.max(0, t)));
  return {
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e + lift * Math.sin(Math.PI * e),
  };
}
