import type { BookTheme } from "./reader";

/**
 * Bet annotatsiyalari: chizma, belgilash (highlight) va matn. Sof mantiq (DOM'siz, testlanadi).
 *
 * Barcha koordinatalar bet o'lchamiga nisbatan 0..1 (zoom va qurilmadan mustaqil); chiziq
 * qalinligi va matn hajmi bet **eniga** nisbatan. Shuning uchun y o'qidagi masofalar hisoblanganda
 * `aspect` (bet balandligi / eni) ga ko'paytiriladi — 1 birlik hamma yo'nalishda bir xil uzunlik.
 */

// --- Tiplar ---

export const ANNOTATION_TOOLS = ["none", "select", "pen", "highlight", "text", "eraser"] as const;
export type AnnotationTool = (typeof ANNOTATION_TOOLS)[number];

/** [x, y, bosim]; bosim 0..1 (sichqonchada 0.5). */
export type StrokePoint = readonly [x: number, y: number, pressure: number];

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DrawingData {
  tool: "pen";
  color: string;
  width: number;
  points: StrokePoint[];
}

export interface HighlightData {
  color: string;
  rects: NormRect[];
}

export interface TextData {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
}

export type Annotation =
  | { id: string; type: "drawing"; data: DrawingData }
  | { id: string; type: "highlight"; data: HighlightData }
  | { id: string; type: "text"; data: TextData };

export type AnnotationType = Annotation["type"];

/** Serverga yuboriladigan shakl (`PUT .../pages/N/annotations/`). */
export interface AnnotationItem {
  id: string;
  type: AnnotationType;
  data: Record<string, unknown>;
}

// --- Chegaralar (backend `annotation_validation.py` bilan bir xil) ---

export const MAX_STROKE_POINTS = 5000;
export const MAX_PER_PAGE = 300;
export const MAX_TEXT_LENGTH = 2000;
export const NOTE_MAX_LENGTH = 20000;
const DEFAULT_PRESSURE = 0.5;

// --- Koordinatalar ---

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export interface BoxRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Ekran koordinatasi → bet ichidagi 0..1 (bet tashqarisiga chiqsa chetga qisiladi). */
export function normalizePoint(clientX: number, clientY: number, box: BoxRect): [number, number] {
  if (box.width <= 0 || box.height <= 0) return [0, 0];
  return [clamp01((clientX - box.left) / box.width), clamp01((clientY - box.top) / box.height)];
}

/** 0..1 → bet qutisidagi piksel (CSS px). */
export function toPixels(
  x: number,
  y: number,
  size: { width: number; height: number },
): [number, number] {
  return [x * size.width, y * size.height];
}

// --- Silliqlash va soddalashtirish ---

/** Kirish nuqtalarini yumshatish (eksponensial o'rtacha): qo'l titrashi va sichqoncha zinapoyasi. */
export function smoothInput(previous: StrokePoint, next: StrokePoint, alpha = 0.55): StrokePoint {
  return [
    previous[0] + (next[0] - previous[0]) * alpha,
    previous[1] + (next[1] - previous[1]) * alpha,
    next[2],
  ];
}

/** Nuqtadan kesmagacha masofa (izotrop birliklarda; y `aspect` ga ko'paytirilgan). */
export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  aspect: number,
): number {
  const x = (px - ax) * 1;
  const y = (py - ay) * aspect;
  const dx = bx - ax;
  const dy = (by - ay) * aspect;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, (x * dx + y * dy) / lengthSquared));
  return Math.hypot(x - t * dx, y - t * dy);
}

function douglasPeucker(
  points: readonly StrokePoint[],
  aspect: number,
  epsilon: number,
): StrokePoint[] {
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number];
    let farthest = -1;
    let maxDistance = epsilon;
    const a = points[start];
    const b = points[end];
    for (let index = start + 1; index < end; index += 1) {
      const p = points[index];
      const distance = distanceToSegment(p[0], p[1], a[0], a[1], b[0], b[1], aspect);
      if (distance > maxDistance) {
        maxDistance = distance;
        farthest = index;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = true;
      stack.push([start, farthest], [farthest, end]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

/**
 * Chiziqni saqlashdan oldin soddalashtiradi (Ramer–Douglas–Peucker): ko'rinish deyarli o'zgarmaydi,
 * hajm kichrayadi. Chegaradan oshsa epsilon oshirib boriladi — `maxPoints` dan ko'p qolmaydi.
 */
export function simplifyStroke(
  points: readonly StrokePoint[],
  aspect: number,
  maxPoints = MAX_STROKE_POINTS,
): StrokePoint[] {
  if (points.length <= 2) return [...points];
  let epsilon = 0.0005;
  let result = douglasPeucker(points, aspect, epsilon);
  while (result.length > maxPoints) {
    epsilon *= 1.6;
    result = douglasPeucker(points, aspect, epsilon);
  }
  return result;
}

/** Yaxlitlash: JSON kichrayadi (backend ham 5 xonagacha yaxlitlaydi). */
export function roundPoint(point: StrokePoint): StrokePoint {
  const round = (value: number) => Math.round(value * 1e5) / 1e5;
  return [round(point[0]), round(point[1]), round(point[2])];
}

// --- Chegara qutilari va hit-test ---

export function drawingBounds(data: DrawingData): NormRect {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const [x, y] of data.points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Matn qutisi (taxminiy: renderdan oldin hit-test va tanlash ramkasi uchun). */
export function textBounds(data: TextData, aspect: number): NormRect {
  const lines = data.text.split("\n");
  const longest = Math.max(...lines.map((line) => line.length), 1);
  const w = Math.min(1 - data.x, Math.max(data.size * 0.6 * longest, data.size));
  const h = Math.min(1 - data.y, (data.size * 1.35 * lines.length) / aspect);
  return { x: data.x, y: data.y, w, h };
}

export function annotationBounds(annotation: Annotation, aspect: number): NormRect {
  switch (annotation.type) {
    case "drawing":
      return drawingBounds(annotation.data);
    case "highlight": {
      const rects = annotation.data.rects;
      const minX = Math.min(...rects.map((rect) => rect.x));
      const minY = Math.min(...rects.map((rect) => rect.y));
      const maxX = Math.max(...rects.map((rect) => rect.x + rect.w));
      const maxY = Math.max(...rects.map((rect) => rect.y + rect.h));
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    case "text":
      return textBounds(annotation.data, aspect);
  }
}

const inside = (x: number, y: number, rect: NormRect, margin = 0) =>
  x >= rect.x - margin &&
  x <= rect.x + rect.w + margin &&
  y >= rect.y - margin &&
  y <= rect.y + rect.h + margin;

/**
 * Nuqta annotatsiyaga tegadimi. `radius` — o'chirgich/barmoq radiusi (bet eni birligida);
 * chiziq uchun qalinlikning yarmi ham qo'shiladi.
 */
export function hitAnnotation(
  annotation: Annotation,
  x: number,
  y: number,
  aspect: number,
  radius: number,
): boolean {
  switch (annotation.type) {
    case "drawing": {
      const { points, width } = annotation.data;
      const reach = radius + width / 2;
      if (points.length === 1) {
        return Math.hypot(x - points[0][0], (y - points[0][1]) * aspect) <= reach;
      }
      for (let index = 1; index < points.length; index += 1) {
        const a = points[index - 1];
        const b = points[index];
        if (distanceToSegment(x, y, a[0], a[1], b[0], b[1], aspect) <= reach) return true;
      }
      return false;
    }
    case "highlight":
      return annotation.data.rects.some((rect) => inside(x, y, rect, radius / 2));
    case "text":
      return inside(x, y, textBounds(annotation.data, aspect), radius / 2);
  }
}

/** Eng ustdagi (oxirgi chizilgan) tegilgan annotatsiya. */
export function topAnnotationAt(
  annotations: readonly Annotation[],
  x: number,
  y: number,
  aspect: number,
  radius: number,
): Annotation | null {
  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    if (hitAnnotation(annotations[index], x, y, aspect, radius)) return annotations[index];
  }
  return null;
}

/** Annotatsiyani siljitadi; bet chegarasidan chiqmaydi (siljish chegaraga qisiladi). */
export function moveAnnotation(
  annotation: Annotation,
  dx: number,
  dy: number,
  aspect: number,
): Annotation {
  const bounds = annotationBounds(annotation, aspect);
  const shiftX = Math.min(1 - (bounds.x + bounds.w), Math.max(-bounds.x, dx));
  const shiftY = Math.min(1 - (bounds.y + bounds.h), Math.max(-bounds.y, dy));
  switch (annotation.type) {
    case "drawing":
      return {
        ...annotation,
        data: {
          ...annotation.data,
          points: annotation.data.points.map(([x, y, p]): StrokePoint => [
            x + shiftX,
            y + shiftY,
            p,
          ]),
        },
      };
    case "highlight":
      return {
        ...annotation,
        data: {
          ...annotation.data,
          rects: annotation.data.rects.map((rect) => ({
            ...rect,
            x: rect.x + shiftX,
            y: rect.y + shiftY,
          })),
        },
      };
    case "text":
      return {
        ...annotation,
        data: { ...annotation.data, x: annotation.data.x + shiftX, y: annotation.data.y + shiftY },
      };
  }
}

/** Sudralgan ikki nuqtadan to'rtburchak; juda kichik bo'lsa `null` (tasodifiy bosish). */
export function rectFromDrag(
  from: readonly [number, number],
  to: readonly [number, number],
  minSize = 0.006,
): NormRect | null {
  const x = Math.min(from[0], to[0]);
  const y = Math.min(from[1], to[1]);
  const w = Math.abs(from[0] - to[0]);
  const h = Math.abs(from[1] - to[1]);
  return w < minSize || h < minSize ? null : { x, y, w, h };
}

// --- Ranglar va o'lchamlar ---

/** "ink" — fon rejimiga moslashadigan asosiy rang (qog'ozda qora, tunda och). */
export const INK = "ink";
export const PEN_COLORS = [INK, "#e5484d", "#3b82f6", "#30a46c", "#f59e0b", "#8e4ec6"] as const;
export const HIGHLIGHT_COLORS = ["#fde047", "#86efac", "#f9a8d4", "#93c5fd"] as const;

/** Chiziq qalinligi va matn hajmi: bet eniga nisbatan. */
export const PEN_WIDTHS = [0.0025, 0.0045, 0.008] as const;
export const TEXT_SIZES = [0.018, 0.026, 0.038] as const;

export const DEFAULT_PEN_COLOR = INK;
export const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[0];
export const DEFAULT_TEXT_COLOR = INK;

const INK_BY_THEME: Record<BookTheme, string> = {
  paper: "#1c1b18",
  sepia: "#3b2c1b",
  night: "#ebe6da",
};

/** Saqlangan rangni joriy fon rejimidagi haqiqiy rangga aylantiradi. */
export function resolveColor(color: string, theme: BookTheme): string {
  return color === INK ? INK_BY_THEME[theme] : color;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Highlight to'ldirish rangi. Qog'oz/sepiyada `multiply` aralashmasi bilan (matn ustida ko'rinadi),
 * tunda (rasm inversiyalangan) oddiy yarim shaffof qatlam bilan.
 */
export function highlightFill(color: string, theme: BookTheme): string {
  const [r, g, b] = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${theme === "night" ? 0.38 : 0.55})`;
}

export function colorLabelKey(color: string): string {
  return color === INK ? "ink" : color.slice(1).toLowerCase();
}

// --- Server bilan almashish ---

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function parsePoints(value: unknown): StrokePoint[] | null {
  if (!Array.isArray(value)) return null;
  const points: StrokePoint[] = [];
  for (const raw of value) {
    if (!Array.isArray(raw) || raw.length < 2 || !isNumber(raw[0]) || !isNumber(raw[1]))
      return null;
    points.push([raw[0], raw[1], isNumber(raw[2]) ? raw[2] : DEFAULT_PRESSURE]);
  }
  return points;
}

function parseRects(value: unknown): NormRect[] | null {
  if (!Array.isArray(value)) return null;
  const rects: NormRect[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || !isNumber(raw.x) || !isNumber(raw.y)) return null;
    if (!isNumber(raw.w) || !isNumber(raw.h)) return null;
    rects.push({ x: raw.x, y: raw.y, w: raw.w, h: raw.h });
  }
  return rects;
}

/** Server qatori → tipli annotatsiya; tuzilishi buzuq (yoki noma'lum tur) bo'lsa `null` (jim tashlanadi). */
export function parseAnnotation(row: {
  id: string;
  type: string;
  data: unknown;
}): Annotation | null {
  const data = row.data;
  if (!isRecord(data) || typeof data.color !== "string") return null;
  if (row.type === "drawing") {
    const points = parsePoints(data.points);
    if (!points || points.length === 0 || !isNumber(data.width)) return null;
    return {
      id: row.id,
      type: "drawing",
      data: { tool: "pen", color: data.color, width: data.width, points },
    };
  }
  if (row.type === "highlight") {
    const rects = parseRects(data.rects);
    if (!rects || rects.length === 0) return null;
    return { id: row.id, type: "highlight", data: { color: data.color, rects } };
  }
  if (row.type === "text") {
    if (typeof data.text !== "string" || !isNumber(data.x) || !isNumber(data.y)) return null;
    if (!isNumber(data.size)) return null;
    return {
      id: row.id,
      type: "text",
      data: { x: data.x, y: data.y, text: data.text, color: data.color, size: data.size },
    };
  }
  return null;
}

export function parseAnnotations(
  rows: readonly { id: string; type: string; data: unknown }[],
): Annotation[] {
  return rows.flatMap((row) => parseAnnotation(row) ?? []);
}

export function toItem(annotation: Annotation): AnnotationItem {
  const data: unknown = annotation.data;
  return { id: annotation.id, type: annotation.type, data: data as Record<string, unknown> };
}

/** Annotatsiyalarni sahifa raqami bo'yicha guruhlaydi (bir so'rovda ko'p bet kelganda). */
export function groupByPage<T extends { page: number }>(rows: readonly T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const row of rows) groups.set(row.page, [...(groups.get(row.page) ?? []), row]);
  return groups;
}

/** Yangi annotatsiya uchun noyob id (server ham UUID kutadi). */
export function newAnnotationId(): string {
  return crypto.randomUUID();
}
