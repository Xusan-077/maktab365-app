/** Grafik maydoni: SVG o'lchami va ko'rsatiladigan koordinata oralig'i. */
export const GRAPH = { width: 400, height: 300, xMin: -8, xMax: 8, yMin: -10, yMax: 10 } as const;

const MINUS = "−";

/** Sonni qisqa ko'rinishda (≤2 xona, ortiqcha nollarsiz) va haqiqiy minus belgisi bilan chiqaradi. */
export function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return (Object.is(rounded, -0) ? 0 : rounded).toString().replace("-", MINUS);
}

function term(coefficient: number, variable: string, first: boolean): string {
  if (coefficient === 0) return "";
  const sign = coefficient < 0 ? MINUS : first ? "" : "+";
  const abs = Math.abs(coefficient);
  const body = variable !== "" && abs === 1 ? variable : `${formatNumber(abs)}${variable}`;
  return first ? `${sign}${body}` : ` ${sign} ${body}`;
}

export interface QuadraticAnalysis {
  equation: string;
  /** a = 0: parabola emas, to'g'ri chiziq. */
  degenerate: boolean;
  discriminant: number;
  /** Haqiqiy ildizlar (o'sish tartibida). */
  roots: number[];
  rootSum: number;
  rootProduct: number;
  vertex: { x: number; y: number };
}

export function analyzeQuadratic(a: number, b: number, c: number): QuadraticAnalysis {
  const parts = [term(a, "x²", true)];
  parts.push(term(b, "x", parts[0] === ""));
  parts.push(term(c, "", parts[0] === "" && parts[1] === ""));
  const equation = `y = ${parts.join("") || "0"}`;

  const discriminant = b * b - 4 * a * c;
  const degenerate = a === 0;
  let roots: number[] = [];
  if (!degenerate && discriminant >= 0) {
    const sqrt = Math.sqrt(discriminant);
    roots = [...new Set([(-b - sqrt) / (2 * a), (-b + sqrt) / (2 * a)])].sort((x, y) => x - y);
  }
  const vertexX = degenerate ? 0 : -b / (2 * a);
  return {
    equation,
    degenerate,
    discriminant,
    roots,
    rootSum: degenerate ? 0 : -b / a,
    rootProduct: degenerate ? 0 : c / a,
    vertex: { x: vertexX, y: a * vertexX * vertexX + b * vertexX + c },
  };
}

/** SVG `path` (y = ax² + bx + c); chegaradan chiqqan qismni `clipPath` kesadi. */
export function buildCurvePath(a: number, b: number, c: number): string {
  const { width, height, xMin, xMax, yMin, yMax } = GRAPH;
  const points: string[] = [];
  for (let px = 0; px <= width; px += 2) {
    const x = xMin + (px / width) * (xMax - xMin);
    const y = a * x * x + b * x + c;
    const py = ((yMax - y) / (yMax - yMin)) * height;
    points.push(`${points.length === 0 ? "M" : "L"}${px} ${py.toFixed(1)}`);
  }
  return points.join(" ");
}
