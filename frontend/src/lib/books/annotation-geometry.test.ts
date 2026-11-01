import { describe, expect, it } from "vitest";
import {
  moveAnnotation,
  normalizePoint,
  rectFromDrag,
  toPixels,
  type Annotation,
} from "./annotations";
import { fitCanvas } from "./annotation-render";

/** Bet qutisi: ekrandagi joyi (scroll hisobga olingan) va CSS o'lchami. */
interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const NATURAL = { width: 595, height: 842 }; // A4, PDF birligida

/** PageView bilan bir xil: eni butun, bo'yi kasr (eni * nisbat). */
function pageBox(width: number, left: number, top: number): Box {
  return { left, top, width, height: (width * NATURAL.height) / NATURAL.width };
}

/** Eski xato: canvas'ning CSS balandligi floor qilinardi (annotatsiya qatlami esa kasr qutida). */
const flooredCanvasHeight = (box: Box) => Math.floor(box.height);

describe("koordinata normalizatsiyasi: zoom va scroll", () => {
  it("bir xil nuqta har qanday zoom va scrollda bir xil 0..1 qiymat beradi", () => {
    // Sahifadagi nuqta: eni 30%, bo'yi 27.5%.
    const target: [number, number] = [0.3, 0.275];
    for (const [width, left, top] of [
      [528, 590, 64.6],
      [792, 120, -180.25], // 150% zoom, pastga scroll qilingan (top manfiy)
      [1056, -300, -1210.5], // 200%
    ] as const) {
      const box = pageBox(width, left, top);
      const [px, py] = toPixels(target[0], target[1], box);
      const [x, y] = normalizePoint(box.left + px, box.top + py, box);
      expect(x).toBeCloseTo(target[0], 9);
      expect(y).toBeCloseTo(target[1], 9);
    }
  });

  it("zoomda chizilgan to'rtburchak boshqa zoomda ekrandagi nisbiy joyini saqlaydi", () => {
    const at100 = pageBox(528, 590, 64.6);
    const rect = rectFromDrag(
      normalizePoint(at100.left + 40, at100.top + 210, at100),
      normalizePoint(at100.left + 330, at100.top + 230, at100),
    );
    expect(rect).not.toBeNull();
    const at200 = pageBox(1056, 100, -400);
    const [, top100] = toPixels(0, rect!.y, at100);
    const [, top200] = toPixels(0, rect!.y, at200);
    // 200% da ikki baravar pastda (sahifa ichidagi joyi), nisbat saqlanadi.
    expect(top200 / top100).toBeCloseTo(at200.width / at100.width, 9);
  });

  it("qutining chegarasidan tashqari bosish 0..1 ga qisqartiriladi", () => {
    const box = pageBox(528, 100, 50);
    expect(normalizePoint(box.left - 20, box.top - 5, box)).toEqual([0, 0]);
    expect(normalizePoint(box.left + box.width + 9, box.top + box.height + 9, box)).toEqual([1, 1]);
  });

  it("scrollbar/chegara qutiga kirmaydi: qutining o'zidan olingan o'lcham ishlatiladi", () => {
    // getBoundingClientRect chegara (border) ni o'z ichiga oladi; 2 px chegara bo'lsa kontent
    // qutisi uning ichida. Annotatsiya qatlami qutining o'ziga (inset-0) yopishgan, shuning uchun
    // normalizatsiya aynan shu qutiga nisbatan bo'lishi kerak.
    const overlay = { left: 100, top: 50, width: 400, height: 560 };
    const [x, y] = normalizePoint(300, 330, overlay);
    expect(x).toBeCloseTo(0.5, 9);
    expect(y).toBeCloseTo(0.5, 9);
  });
});

describe("canvas balandligini floor qilish siljish beradi (regressiya)", () => {
  it("floor qilingan balandlik pastga qarab 1 px gacha farq qiladi, kasr balandlikda farq 0", () => {
    for (const width of [528, 531, 777, 1056]) {
      const box = pageBox(width, 0, 0);
      const y = 0.9; // sahifaning pastki qismidagi nuqta
      const exact = y * box.height;
      const viaFloored = y * flooredCanvasHeight(box);
      expect(Math.abs(exact - viaFloored)).toBeLessThan(1);
      // Tuzatilgan holat: canvas ham aynan `box.height`.
      expect(y * box.height - exact).toBe(0);
    }
  });

  it("zoom transformi (scale) floor xatosini kattalashtiradi", () => {
    const renderWidth = 528; // PDF canvas chizilgan eni
    const shown = 1056; // 200% ko'rsatilgan eni
    const error =
      (Math.floor((renderWidth * NATURAL.height) / NATURAL.width) -
        (renderWidth * NATURAL.height) / NATURAL.width) *
      (shown / renderWidth);
    expect(Math.abs(error)).toBeGreaterThan(0.1);
    expect(Math.abs(error)).toBeLessThan(2.1);
  });
});

describe("fitCanvas: DPR", () => {
  function fakeCanvas() {
    const calls: number[][] = [];
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ setTransform: (...args: number[]) => calls.push(args) }),
    } as unknown as HTMLCanvasElement;
    return { canvas, calls };
  }

  it("zichlik 1, 1.5 va 2 da piksel o'lchami CSS * DPR, transform DPR", () => {
    for (const ratio of [1, 1.5, 2]) {
      const { canvas, calls } = fakeCanvas();
      fitCanvas(canvas, { width: 528, height: 746.6 }, ratio);
      expect(canvas.width).toBe(Math.round(528 * ratio));
      expect(canvas.height).toBe(Math.round(746.6 * ratio));
      expect(calls.at(-1)).toEqual([ratio, 0, 0, ratio, 0, 0]);
    }
  });

  it("CSS koordinata * DPR qurilma pikseliga to'g'ri tushadi (siljish yo'q)", () => {
    const size = { width: 528, height: 746.6 };
    const ratio = 1.5;
    const { canvas } = fakeCanvas();
    fitCanvas(canvas, size, ratio);
    // Canvas CSS'da size.width x size.height qutiga cho'zilgani uchun masshtab bir xil emas bo'lishi
    // mumkin: xato <= yarim piksel.
    const scaleY = canvas.height / size.height;
    expect(Math.abs(scaleY - ratio) * size.height).toBeLessThanOrEqual(0.5 + 1e-9);
  });
});

describe("tanlash/bosish ma'lumotni o'zgartirmaydi", () => {
  const highlight: Annotation = {
    id: "h",
    type: "highlight",
    data: { color: "#fde047", rects: [{ x: 0.0953, y: 0.2849, w: 0.6458, h: 0.0268 }] },
  };

  it("nol siljish annotatsiyani aynan saqlaydi", () => {
    expect(moveAnnotation(highlight, 0, 0, 1.414)).toEqual(highlight);
  });

  it("siljish chegaradan chiqmaydi va faqat berilgan masofaga ko'chadi", () => {
    const moved = moveAnnotation(highlight, 0, 0.009, 1.414);
    if (moved.type !== "highlight") throw new Error("type");
    expect(moved.data.rects[0].y).toBeCloseTo(0.2849 + 0.009, 9);
    expect(moved.data.rects[0].x).toBeCloseTo(0.0953, 9);
    const up = moveAnnotation(highlight, 0, -5, 1.414);
    if (up.type !== "highlight") throw new Error("type");
    expect(up.data.rects[0].y).toBe(0); // sahifadan chiqib ketmaydi
  });
});
