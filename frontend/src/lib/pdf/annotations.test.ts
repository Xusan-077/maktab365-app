import { describe, expect, it } from "vitest";
import {
  annotationsOnPage,
  MIN_RECT,
  newAnnotation,
  NOTE_MAX,
  rectFromDrag,
  sanitizeAnnotations,
  sortAnnotations,
  upsertAnnotation,
  type Annotation,
} from "./annotations";

const bounds = { left: 100, top: 50, width: 400, height: 600 };
const rect = { x: 0.1, y: 0.1, w: 0.2, h: 0.05 };
const make = (id: string, page: number): Annotation =>
  newAnnotation({ id, bookId: "b", page, color: "yellow", rect });

describe("rectFromDrag", () => {
  it("sudrashni sahifa ulushiga o'tkazadi (har qaysi yo'nalishda)", () => {
    const forward = rectFromDrag({ x: 140, y: 110 }, { x: 300, y: 170 }, bounds)!;
    expect(forward.x).toBeCloseTo(0.1);
    expect(forward.y).toBeCloseTo(0.1);
    expect(forward.w).toBeCloseTo(0.4);
    expect(forward.h).toBeCloseTo(0.1);
    expect(rectFromDrag({ x: 300, y: 170 }, { x: 140, y: 110 }, bounds)).toEqual(forward);
  });
  it("sahifadan tashqarisini qirqadi", () => {
    const r = rectFromDrag({ x: 0, y: 0 }, { x: 9999, y: 9999 }, bounds)!;
    expect(r).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
  it("juda kichik sudrash yoki nol o'lcham — null", () => {
    expect(rectFromDrag({ x: 200, y: 200 }, { x: 201, y: 201 }, bounds)).toBeNull();
    expect(rectFromDrag({ x: 1, y: 1 }, { x: 50, y: 50 }, { ...bounds, width: 0 })).toBeNull();
    expect(MIN_RECT).toBeGreaterThan(0);
  });
});

describe("annotations helpers", () => {
  it("newAnnotation eslatmani kesadi va tozalaydi, id beradi", () => {
    const a = newAnnotation({
      bookId: "b",
      page: 2,
      color: "pink",
      rect,
      note: `  ${"x".repeat(NOTE_MAX + 50)}`,
    });
    expect(a.note).toHaveLength(NOTE_MAX);
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.rects).toEqual([rect]);
  });
  it("upsert id bo'yicha almashtiradi yoki qo'shadi", () => {
    const list = [make("1", 1), make("2", 2)];
    expect(upsertAnnotation(list, { ...list[0], note: "yangi" })[0].note).toBe("yangi");
    expect(upsertAnnotation(list, make("3", 3))).toHaveLength(3);
    expect(list).toHaveLength(2); // asl ro'yxat o'zgarmaydi
  });
  it("sahifa bo'yicha filtr va saralash", () => {
    const list = [make("a", 5), make("b", 2), make("c", 5)];
    expect(annotationsOnPage(list, 5).map((x) => x.id)).toEqual(["a", "c"]);
    expect(sortAnnotations(list).map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
  it("sanitize buzilgan yozuvlarni tashlaydi", () => {
    expect(sanitizeAnnotations(null)).toEqual([]);
    const good = make("g", 1);
    expect(
      sanitizeAnnotations([good, { ...good, color: "red" }, { ...good, rects: [] }, 7, null]),
    ).toEqual([good]);
  });
});
