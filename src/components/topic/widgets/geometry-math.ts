export type Point = { x: number; y: number };

/** Katak to'ri: koordinatalar 0…GRID_SIZE oralig'ida, butun sonlar. */
export const GRID_SIZE = 10;

export const clampToGrid = (value: number) => Math.min(GRID_SIZE, Math.max(0, Math.round(value)));

/** Ikki nuqta orasidagi masofaning kvadrati (butun koordinatalarda aniq). */
export const squaredDistance = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export type AngleKind = "right" | "acute" | "obtuse" | "degenerate";
export type SideKind = "equilateral" | "isosceles" | "scalene";

export interface TriangleAnalysis {
  /** Tomonlar kvadrati: [AB, BC, CA]. */
  squares: [number, number, number];
  /** Tomonlar uzunligi: [AB, BC, CA]. */
  lengths: [number, number, number];
  angleKind: AngleKind;
  /** Degenerat bo'lmasa tomonlar bo'yicha tur. */
  sideKind: SideKind | null;
  /** To'g'ri burchakli bo'lsa: katetlar kvadrati yig'indisi gipotenuza kvadratiga teng. */
  pythagoras: { legs: [number, number]; hypotenuse: number } | null;
}

/** Uchburchakni butun sonlarda tahlil qiladi (suzuvchi nuqta xatosisiz: tengliklar kvadratlar orqali). */
export function analyzeTriangle([a, b, c]: [Point, Point, Point]): TriangleAnalysis {
  const squares: [number, number, number] = [
    squaredDistance(a, b),
    squaredDistance(b, c),
    squaredDistance(c, a),
  ];
  const lengths = squares.map(Math.sqrt) as [number, number, number];
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (cross === 0) {
    return { squares, lengths, angleKind: "degenerate", sideKind: null, pythagoras: null };
  }

  const sorted = [...squares].sort((p, q) => p - q);
  const [shortest, middle, longest] = sorted;
  const legSum = shortest + middle;
  const angleKind: AngleKind = longest === legSum ? "right" : longest < legSum ? "acute" : "obtuse";

  const equalPairs =
    Number(squares[0] === squares[1]) +
    Number(squares[1] === squares[2]) +
    Number(squares[2] === squares[0]);
  const sideKind: SideKind =
    equalPairs === 3 ? "equilateral" : equalPairs > 0 ? "isosceles" : "scalene";

  return {
    squares,
    lengths,
    angleKind,
    sideKind,
    pythagoras: angleKind === "right" ? { legs: [shortest, middle], hypotenuse: longest } : null,
  };
}
