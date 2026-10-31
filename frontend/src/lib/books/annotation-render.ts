import {
  highlightFill,
  resolveColor,
  type Annotation,
  type DrawingData,
  type NormRect,
  type StrokePoint,
  type TextData,
} from "./annotations";
import type { BookTheme } from "./reader";

/** Canvas chizish yordamchilari (DOM'siz: `CanvasRenderingContext2D` beriladi). */

export interface CanvasSize {
  width: number;
  height: number;
}

/** Chiziq qalinligi bosimga qarab 0.4×…1.6× (sichqonchada bosim 0.5 → aynan 1×). */
export function pressureWidth(base: number, pressure: number): number {
  const p = Math.min(1, Math.max(0, pressure));
  return base * (0.4 + p * 1.2);
}

function hasPressureVariation(points: readonly StrokePoint[]): boolean {
  if (points.length < 2) return false;
  const first = points[0][2];
  return points.some((point) => Math.abs(point[2] - first) > 0.08);
}

/** Bitta chiziqni chizadi: o'rta nuqtalar bo'yicha kvadratik egri (silliq), bosim farqi bo'lsa segment-segment. */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  data: DrawingData,
  size: CanvasSize,
  theme: BookTheme,
): void {
  const { points } = data;
  if (points.length === 0) return;
  const color = resolveColor(data.color, theme);
  const base = Math.max(data.width * size.width, 0.6);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const px = (point: StrokePoint) => [point[0] * size.width, point[1] * size.height] as const;

  if (points.length === 1) {
    const [x, y] = px(points[0]);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(base / 2, 0.8), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (hasPressureVariation(points)) {
    for (let index = 1; index < points.length; index += 1) {
      const [x0, y0] = px(points[index - 1]);
      const [x1, y1] = px(points[index]);
      ctx.lineWidth = pressureWidth(base, (points[index - 1][2] + points[index][2]) / 2);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  } else {
    ctx.lineWidth = base;
    ctx.beginPath();
    const [startX, startY] = px(points[0]);
    ctx.moveTo(startX, startY);
    for (let index = 1; index < points.length - 1; index += 1) {
      const [x, y] = px(points[index]);
      const [nextX, nextY] = px(points[index + 1]);
      ctx.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2);
    }
    const [endX, endY] = px(points[points.length - 1]);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHighlightRects(
  ctx: CanvasRenderingContext2D,
  color: string,
  rects: readonly NormRect[],
  size: CanvasSize,
  theme: BookTheme,
): void {
  ctx.save();
  ctx.fillStyle = highlightFill(color, theme);
  for (const rect of rects) {
    ctx.fillRect(
      rect.x * size.width,
      rect.y * size.height,
      rect.w * size.width,
      rect.h * size.height,
    );
  }
  ctx.restore();
}

/** Qatlam turi: highlight alohida canvas'da (CSS `multiply`), chiziqlar — alohida. */
export function renderHighlights(
  ctx: CanvasRenderingContext2D,
  items: readonly Annotation[],
  size: CanvasSize,
  theme: BookTheme,
  hidden?: ReadonlySet<string>,
): void {
  ctx.clearRect(0, 0, size.width, size.height);
  for (const item of items) {
    if (item.type === "highlight" && !hidden?.has(item.id)) {
      drawHighlightRects(ctx, item.data.color, item.data.rects, size, theme);
    }
  }
}

export function renderStrokes(
  ctx: CanvasRenderingContext2D,
  items: readonly Annotation[],
  size: CanvasSize,
  theme: BookTheme,
  hidden?: ReadonlySet<string>,
): void {
  ctx.clearRect(0, 0, size.width, size.height);
  for (const item of items) {
    if (item.type === "drawing" && !hidden?.has(item.id)) drawStroke(ctx, item.data, size, theme);
  }
}

/** Canvas'ni CSS o'lchamiga va qurilma piksel zichligiga moslaydi (zoom/to'liq ekranda xira bo'lmasin). */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  size: CanvasSize,
  ratio: number,
): CanvasRenderingContext2D | null {
  const width = Math.max(1, Math.round(size.width * ratio));
  const height = Math.max(1, Math.round(size.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

/** Matn qatlami (DOM) bilan bir xil: qator balandligi 1.35 × shrift. */
export const TEXT_LINE_HEIGHT = 1.35;

/** Matnni `maxWidth` ga sig'dirib qatorlarga bo'ladi (yangi qator saqlanadi; juda uzun so'z bo'linmaydi). */
export function wrapLines(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const next = line === "" ? word : `${line} ${word}`;
      if (line !== "" && measure(next) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Matn annotatsiyasini canvas'ga chizadi (eksport va eskizlar; chizish oynasida DOM ishlatiladi). */
export function drawTextAnnotation(
  ctx: CanvasRenderingContext2D,
  data: TextData,
  size: CanvasSize,
  theme: BookTheme,
  fontFamily = "system-ui, sans-serif",
): void {
  const fontSize = data.size * size.width;
  const lineHeight = fontSize * TEXT_LINE_HEIGHT;
  ctx.save();
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = resolveColor(data.color, theme);
  ctx.textBaseline = "top";
  const maxWidth = (1 - data.x) * size.width;
  const lines = wrapLines((value) => ctx.measureText(value).width, data.text, maxWidth);
  lines.forEach((line, index) => {
    ctx.fillText(
      line,
      data.x * size.width,
      data.y * size.height + index * lineHeight + (lineHeight - fontSize) / 2,
    );
  });
  ctx.restore();
}

/** Barcha annotatsiyalarni tartib bilan (belgilash → chizma → matn) bitta canvas'ga chizadi. */
export function renderAll(
  ctx: CanvasRenderingContext2D,
  items: readonly Annotation[],
  size: CanvasSize,
  theme: BookTheme,
  fontFamily?: string,
): void {
  ctx.save();
  // Qog'ozda belgilash matn ustida ko'rinishi uchun ko'paytirish (chizish oynasidagi CSS `multiply` kabi).
  if (theme !== "night") ctx.globalCompositeOperation = "multiply";
  for (const item of items) {
    if (item.type === "highlight")
      drawHighlightRects(ctx, item.data.color, item.data.rects, size, theme);
  }
  ctx.restore();
  for (const item of items) if (item.type === "drawing") drawStroke(ctx, item.data, size, theme);
  for (const item of items) {
    if (item.type === "text") drawTextAnnotation(ctx, item.data, size, theme, fontFamily);
  }
}
