import { describe, expect, it } from "vitest";
import {
  distanceToSegment,
  hitAnnotation,
  highlightFill,
  moveAnnotation,
  normalizePoint,
  parseAnnotation,
  parseAnnotations,
  rectFromDrag,
  resolveColor,
  simplifyStroke,
  toPixels,
  topAnnotationAt,
  type Annotation,
  type StrokePoint,
} from "./annotations";

const ASPECT = 1.4; // bet balandligi / eni

const drawing = (points: StrokePoint[], width = 0.004): Annotation => ({
  id: "d1",
  type: "drawing",
  data: { tool: "pen", color: "ink", width, points },
});
const highlight = (): Annotation => ({
  id: "h1",
  type: "highlight",
  data: { color: "#fde047", rects: [{ x: 0.2, y: 0.3, w: 0.4, h: 0.05 }] },
});
const text = (): Annotation => ({
  id: "t1",
  type: "text",
  data: { x: 0.5, y: 0.5, text: "Salom", color: "ink", size: 0.03 },
});

describe("normalizePoint / toPixels", () => {
  const box = { left: 100, top: 50, width: 400, height: 560 };

  it("ekran koordinatasini bet ichidagi 0..1 ga aylantiradi", () => {
    expect(normalizePoint(300, 330, box)).toEqual([0.5, 0.5]);
    expect(normalizePoint(100, 50, box)).toEqual([0, 0]);
  });

  it("bet tashqarisidagi nuqta chetga qisiladi", () => {
    expect(normalizePoint(0, 9999, box)).toEqual([0, 1]);
  });

  it("zoom o'zgarsa ham normallashgan koordinata bir xil, piksel mutanosib", () => {
    const zoomed = { left: 0, top: 0, width: 800, height: 1120 }; // 2×
    const normalized = normalizePoint(300, 330, box);
    const again = normalizePoint(
      zoomed.left + normalized[0] * zoomed.width,
      zoomed.top + normalized[1] * zoomed.height,
      zoomed,
    );
    expect(again).toEqual(normalized);
    expect(toPixels(0.25, 0.5, { width: 400, height: 560 })).toEqual([100, 280]);
    expect(toPixels(0.25, 0.5, { width: 800, height: 1120 })).toEqual([200, 560]);
  });

  it("o'lchamsiz quti (hali chizilmagan) xato bermaydi", () => {
    expect(normalizePoint(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual([0, 0]);
  });
});

describe("simplifyStroke", () => {
  it("to'g'ri chiziqdagi oraliq nuqtalarni olib tashlaydi, uchlarini saqlaydi", () => {
    const line: StrokePoint[] = Array.from({ length: 50 }, (_, i) => [i / 100, 0.5, 0.5]);
    const result = simplifyStroke(line, ASPECT);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(line[0]);
    expect(result[1]).toEqual(line[49]);
  });

  it("burilishni saqlaydi", () => {
    const corner: StrokePoint[] = [
      [0.1, 0.1, 0.5],
      [0.3, 0.1, 0.5],
      [0.5, 0.1, 0.5],
      [0.5, 0.3, 0.5],
      [0.5, 0.5, 0.5],
    ];
    expect(simplifyStroke(corner, ASPECT).map((p) => [p[0], p[1]])).toEqual([
      [0.1, 0.1],
      [0.5, 0.1],
      [0.5, 0.5],
    ]);
  });

  it("chegaradan oshgan chiziq maxPoints ga tushadi", () => {
    const wavy: StrokePoint[] = Array.from({ length: 400 }, (_, i) => [
      i / 400,
      0.5 + Math.sin(i / 3) * 0.1,
      0.5,
    ]);
    expect(simplifyStroke(wavy, ASPECT, 50).length).toBeLessThanOrEqual(50);
  });

  it("bitta nuqta (tegib qo'yish) saqlanadi", () => {
    expect(simplifyStroke([[0.4, 0.4, 0.5]], ASPECT)).toHaveLength(1);
  });
});

describe("distanceToSegment", () => {
  it("y o'qi bet nisbati bilan o'lchanadi", () => {
    // Bir xil normallashgan farq y bo'yicha aspect marta uzunroq.
    expect(distanceToSegment(0.5, 0.6, 0, 0.5, 1, 0.5, 1)).toBeCloseTo(0.1);
    expect(distanceToSegment(0.5, 0.6, 0, 0.5, 1, 0.5, ASPECT)).toBeCloseTo(0.14);
  });

  it("uchdan tashqarida eng yaqin uchgacha", () => {
    expect(distanceToSegment(2, 0, 0, 0, 1, 0, 1)).toBeCloseTo(1);
  });
});

describe("hitAnnotation / topAnnotationAt", () => {
  const stroke = drawing([
    [0.1, 0.5, 0.5],
    [0.9, 0.5, 0.5],
  ]);

  it("chiziqqa radius ichida tegadi, uzoqda tegmaydi", () => {
    expect(hitAnnotation(stroke, 0.5, 0.505, ASPECT, 0.01)).toBe(true);
    expect(hitAnnotation(stroke, 0.5, 0.6, ASPECT, 0.01)).toBe(false);
  });

  it("highlight to'rtburchagi va matn qutisiga tegadi", () => {
    expect(hitAnnotation(highlight(), 0.3, 0.32, ASPECT, 0.01)).toBe(true);
    expect(hitAnnotation(highlight(), 0.8, 0.9, ASPECT, 0.01)).toBe(false);
    expect(hitAnnotation(text(), 0.52, 0.51, ASPECT, 0.01)).toBe(true);
  });

  it("bitta nuqtali chiziq (nuqta) ham o'chiriladi", () => {
    const dot = drawing([[0.4, 0.4, 0.5]], 0.01);
    expect(hitAnnotation(dot, 0.402, 0.4, ASPECT, 0.01)).toBe(true);
  });

  it("ustma-ust bo'lsa eng oxirgisi qaytadi", () => {
    const covering: Annotation = { ...highlight(), id: "h2" };
    expect(topAnnotationAt([highlight(), covering], 0.3, 0.32, ASPECT, 0.01)?.id).toBe("h2");
    expect(topAnnotationAt([], 0.3, 0.3, ASPECT, 0.01)).toBeNull();
  });
});

describe("moveAnnotation", () => {
  it("barcha nuqtalarni bir xil siljitadi", () => {
    const moved = moveAnnotation(
      drawing([
        [0.2, 0.2, 0.5],
        [0.3, 0.3, 0.7],
      ]),
      0.1,
      0.05,
      ASPECT,
    );
    expect(moved.type === "drawing" && moved.data.points[1]).toEqual([0.4, 0.35, 0.7]);
  });

  it("bet chegarasidan chiqarmaydi", () => {
    const moved = moveAnnotation(highlight(), 5, -5, ASPECT);
    expect(moved.type === "highlight" && moved.data.rects[0].x).toBeCloseTo(0.6);
    expect(moved.type === "highlight" && moved.data.rects[0].y).toBeCloseTo(0);
  });

  it("matnni siljitadi va asl obyektni o'zgartirmaydi", () => {
    const original = text();
    const moved = moveAnnotation(original, 0.1, 0.1, ASPECT);
    expect(moved.type === "text" && moved.data.x).toBeCloseTo(0.6);
    expect(original.type === "text" && original.data.x).toBe(0.5);
  });
});

describe("rectFromDrag", () => {
  it("istalgan yo'nalishda sudralganda to'rtburchak hosil qiladi", () => {
    const rect = rectFromDrag([0.6, 0.4], [0.2, 0.3]);
    expect(rect?.x).toBeCloseTo(0.2);
    expect(rect?.y).toBeCloseTo(0.3);
    expect(rect?.w).toBeCloseTo(0.4);
    expect(rect?.h).toBeCloseTo(0.1);
  });

  it("tasodifiy bosish (juda kichik) bekor qilinadi", () => {
    expect(rectFromDrag([0.5, 0.5], [0.502, 0.502])).toBeNull();
  });
});

describe("ranglar", () => {
  it("'ink' fon rejimiga moslashadi, boshqa rang o'zgarmaydi", () => {
    expect(resolveColor("ink", "paper")).not.toBe(resolveColor("ink", "night"));
    expect(resolveColor("#e5484d", "night")).toBe("#e5484d");
  });

  it("highlight tunda boshqa shaffoflik bilan", () => {
    expect(highlightFill("#fde047", "paper")).toBe("rgba(253, 224, 71, 0.55)");
    expect(highlightFill("#fde047", "night")).toBe("rgba(253, 224, 71, 0.38)");
  });
});

describe("parseAnnotation", () => {
  it("serverdagi chizmani tipli shaklga o'tkazadi (bosim yo'q bo'lsa 0.5)", () => {
    const parsed = parseAnnotation({
      id: "a",
      type: "drawing",
      data: {
        tool: "pen",
        color: "ink",
        width: 0.004,
        points: [
          [0.1, 0.2],
          [0.3, 0.4, 0.9],
        ],
      },
    });
    expect(parsed?.type === "drawing" && parsed.data.points).toEqual([
      [0.1, 0.2, 0.5],
      [0.3, 0.4, 0.9],
    ]);
  });

  it("buzuq yoki noma'lum yozuvni jim tashlaydi", () => {
    expect(parseAnnotation({ id: "a", type: "drawing", data: { color: "ink" } })).toBeNull();
    expect(parseAnnotation({ id: "a", type: "sticker", data: { color: "ink" } })).toBeNull();
    expect(parseAnnotation({ id: "a", type: "text", data: "matn" })).toBeNull();
    expect(
      parseAnnotations([
        {
          id: "a",
          type: "highlight",
          data: { color: "#fde047", rects: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.1 }] },
        },
        { id: "b", type: "highlight", data: { color: "#fde047", rects: [] } },
      ]),
    ).toHaveLength(1);
  });
});
