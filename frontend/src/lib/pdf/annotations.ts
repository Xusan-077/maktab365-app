/** Sahifa belgilari (highlight + qisqa eslatma): sof mantiq. Rect'lar sahifa o'lchamiga nisbatan 0..1. */

export const ANNOTATION_COLORS = ["yellow", "green", "pink"] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];

export const NOTE_MAX = 200;
/** Shundan kichik (sahifa ulushida) belgi tasodifiy bosish hisoblanadi va yaratilmaydi. */
export const MIN_RECT = 0.012;

export interface AnnotationRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Annotation {
  /** Mijozda yaratilgan UUID: takror yozish va mehmon ma'lumotini qo'shish idempotent. */
  id: string;
  pdf_book_id: string;
  page: number;
  color: AnnotationColor;
  rects: AnnotationRect[];
  note: string;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Sudrash (boshlanish → tugash, piksellarda) va sahifa chegarasi (`bounds`) bo'yicha rect.
 * Sahifadan tashqariga chiqqan qism qirqiladi; juda kichik bo'lsa `null`.
 */
export function rectFromDrag(
  start: { x: number; y: number },
  end: { x: number; y: number },
  bounds: { left: number; top: number; width: number; height: number },
): AnnotationRect | null {
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  const toUnit = (value: number, origin: number, size: number) => clamp01((value - origin) / size);
  const x1 = toUnit(start.x, bounds.left, bounds.width);
  const x2 = toUnit(end.x, bounds.left, bounds.width);
  const y1 = toUnit(start.y, bounds.top, bounds.height);
  const y2 = toUnit(end.y, bounds.top, bounds.height);
  const rect = {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
  return rect.w < MIN_RECT || rect.h < MIN_RECT ? null : rect;
}

export function newAnnotation(input: {
  bookId: string;
  page: number;
  color: AnnotationColor;
  rect: AnnotationRect;
  note?: string;
  id?: string;
}): Annotation {
  return {
    id: input.id ?? crypto.randomUUID(),
    pdf_book_id: input.bookId,
    page: input.page,
    color: input.color,
    rects: [input.rect],
    note: (input.note ?? "").trim().slice(0, NOTE_MAX),
  };
}

export const annotationsOnPage = (items: readonly Annotation[], page: number): Annotation[] =>
  items.filter((item) => item.page === page);

/** Ro'yxat: sahifa, keyin yaratilish tartibi (kelish tartibi saqlanadi). */
export const sortAnnotations = (items: readonly Annotation[]): Annotation[] =>
  [...items].sort((a, b) => a.page - b.page);

/** `id` bo'yicha qo'shadi yoki almashtiradi (optimistic yangilash uchun). */
export function upsertAnnotation(items: readonly Annotation[], next: Annotation): Annotation[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index < 0) return [...items, next];
  return items.map((item, i) => (i === index ? next : item));
}

/** Xotira/serverdan kelgan ro'yxatning yaroqli yozuvlari. */
export function sanitizeAnnotations(value: unknown): Annotation[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Annotation =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Annotation).id === "string" &&
      typeof (item as Annotation).pdf_book_id === "string" &&
      typeof (item as Annotation).page === "number" &&
      (ANNOTATION_COLORS as readonly string[]).includes((item as Annotation).color) &&
      Array.isArray((item as Annotation).rects) &&
      (item as Annotation).rects.length > 0,
  );
}
