import { describe, expect, it } from "vitest";
import {
  annotationBounds,
  hitAnnotation,
  moveAnnotation,
  parseAnnotation,
  toItem,
  topAnnotationAt,
  type Annotation,
} from "./annotations";
import { solutionsOf } from "./entries";
import type { PageEntry } from "./api";

const solution: Annotation = {
  id: "s1",
  type: "solution",
  data: { rect: { x: 0.1, y: 0.2, w: 0.5, h: 0.2 }, title: "12-misol", body: "$x^2$" },
};

describe("misol yechimi annotatsiyasi", () => {
  it("serverdan o'qiladi va qaytib yuboriladi (rang maydoni talab qilinmaydi)", () => {
    const parsed = parseAnnotation({ id: "s1", type: "solution", data: toItem(solution).data });
    expect(parsed).toEqual(solution);
    expect(toItem(solution)).toEqual({ id: "s1", type: "solution", data: solution.data });
  });

  it("noto'g'ri tuzilma jim tashlanadi", () => {
    expect(parseAnnotation({ id: "x", type: "solution", data: { title: "a" } })).toBeNull();
    expect(
      parseAnnotation({ id: "x", type: "solution", data: { rect: { x: 0 }, body: "" } }),
    ).toBeNull();
    expect(parseAnnotation({ id: "x", type: "solution", data: null })).toBeNull();
  });

  it("sarlavhasiz yechim bo'sh sarlavha bilan o'qiladi", () => {
    const parsed = parseAnnotation({
      id: "x",
      type: "solution",
      data: { rect: { x: 0, y: 0, w: 0.2, h: 0.2 }, body: "yechim" },
    });
    expect(parsed?.type === "solution" && parsed.data.title).toBe("");
  });

  it("chegara qutisi va hit-test maydonning o'zi", () => {
    expect(annotationBounds(solution, 1.41)).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.2 });
    expect(hitAnnotation(solution, 0.3, 0.3, 1.41, 0.012)).toBe(true);
    expect(hitAnnotation(solution, 0.9, 0.9, 1.41, 0.012)).toBe(false);
  });

  it("siljitish maydonni bet ichida ushlab turadi", () => {
    const moved = moveAnnotation(solution, 0.1, 0.1, 1.41);
    if (moved.type !== "solution") throw new Error("type");
    expect(moved.data.rect.x).toBeCloseTo(0.2, 9);
    expect(moved.data.rect.y).toBeCloseTo(0.3, 9);
    expect(moved.data.rect.w).toBe(0.5);
    const clamped = moveAnnotation(solution, 5, 5, 1.41);
    if (clamped.type !== "solution") throw new Error("type");
    expect(clamped.data.rect.x + clamped.data.rect.w).toBeCloseTo(1, 9);
    expect(clamped.data.rect.y + clamped.data.rect.h).toBeCloseTo(1, 9);
  });

  it("maydon ichidagi chizma yechimdan oldin tanlanadi (keyin chizilgan bo'lsa ham)", () => {
    const stroke: Annotation = {
      id: "d1",
      type: "drawing",
      data: {
        tool: "pen",
        color: "ink",
        width: 0.004,
        points: [
          [0.2, 0.3, 0.5],
          [0.4, 0.3, 0.5],
        ],
      },
    };
    const list = [stroke, solution]; // yechim keyin qo'shilgan
    expect(topAnnotationAt(list, 0.3, 0.3, 1.41, 0.012)?.id).toBe("d1");
    expect(topAnnotationAt(list, 0.5, 0.38, 1.41, 0.012)?.id).toBe("s1");
  });
});

describe("solutionsOf", () => {
  it("yozuvdagi yechimlarni tartib bilan qaytaradi", () => {
    const entry = {
      annotations: [
        { id: "h", type: "highlight", data: { color: "#fde047", rects: [] } },
        { id: "s1", type: "solution", data: solution.data },
        {
          id: "s2",
          type: "solution",
          data: { rect: { x: 0, y: 0.7, w: 0.3, h: 0.1 }, title: "", body: "javob 4" },
        },
      ],
    } as unknown as PageEntry;
    expect(solutionsOf(entry)).toEqual([
      { id: "s1", title: "12-misol", body: "$x^2$" },
      { id: "s2", title: "", body: "javob 4" },
    ]);
  });
});
