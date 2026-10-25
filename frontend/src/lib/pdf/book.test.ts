import { describe, expect, it } from "vitest";
import {
  bookPageSize,
  bookSpread,
  clampPan,
  fitScale,
  flipDirection,
  isNeighbourFlip,
  panBounds,
  prefersSimpleFlip,
  renderPixelRatio,
  spreadRange,
  stackDepths,
  stackShadow,
  zoomAround,
} from "./book";

describe("bookSpread: ochiq kitob (juft/toq betlar)", () => {
  it("muqova (1-bet) yolg'iz o'ngda, keyin juft chapda, toq o'ngda", () => {
    expect(bookSpread(1, 240, true)).toEqual({ start: 1, left: null, right: 1 });
    expect(bookSpread(2, 240, true)).toEqual({ start: 2, left: 2, right: 3 });
    expect(bookSpread(3, 240, true)).toEqual({ start: 2, left: 2, right: 3 });
    expect(bookSpread(77, 240, true)).toEqual({ start: 76, left: 76, right: 77 });
  });

  it("juft sonli kitobning oxirgi beti yolg'iz chapda; toqda — oxirgi juftlik", () => {
    expect(bookSpread(240, 240, true)).toEqual({ start: 240, left: 240, right: null });
    expect(bookSpread(239, 240, true)).toEqual({ start: 238, left: 238, right: 239 });
    expect(bookSpread(241, 241, true)).toEqual({ start: 240, left: 240, right: 241 });
  });

  it("bitta bet rejimida — faqat o'ng (yagona) bet", () => {
    expect(bookSpread(33, 240, false)).toEqual({ start: 33, left: null, right: 33 });
  });

  it("e'lon uchun oraliq: «32–33», muqovada «1»", () => {
    expect(spreadRange(bookSpread(33, 240, true))).toEqual({ from: 32, to: 33 });
    expect(spreadRange(bookSpread(1, 240, true))).toEqual({ from: 1, to: 1 });
    expect(spreadRange(bookSpread(240, 240, true))).toEqual({ from: 240, to: 240 });
  });
});

describe("sakrash yo'nalishi", () => {
  it("oldinga / orqaga / joyida", () => {
    expect(flipDirection(10, 12)).toBe(1);
    expect(flipDirection(12, 10)).toBe(-1);
    expect(flipDirection(5, 5)).toBe(0);
  });

  it("qo'shni yoyma — oddiy ag'darish, uzog'i — sakrash", () => {
    expect(isNeighbourFlip(1, 2, 240, true)).toBe(true); // muqova → 2–3
    expect(isNeighbourFlip(2, 1, 240, true)).toBe(true);
    expect(isNeighbourFlip(32, 34, 240, true)).toBe(true);
    expect(isNeighbourFlip(32, 30, 240, true)).toBe(true);
    expect(isNeighbourFlip(32, 36, 240, true)).toBe(false);
    expect(isNeighbourFlip(5, 6, 240, false)).toBe(true);
    expect(isNeighbourFlip(5, 50, 240, false)).toBe(false);
  });
});

describe("fit hisobi", () => {
  const stage = { width: 1200, height: 800 };

  it("ikki bet: kitob stage ichiga padding bilan to'liq sig'adi, nisbat saqlanadi", () => {
    const page = bookPageSize(1.4, true, stage, 28);
    // Balandlik cheklaydi: (800 − 56) / 1.4 = 531 eni.
    expect(page).toEqual({ width: 531, height: 743 });
    expect(2 * page.width).toBeLessThanOrEqual(stage.width - 56);
    expect(page.height).toBeLessThanOrEqual(stage.height - 56);
  });

  it("bitta bet (mobil 390px): eni cheklaydi", () => {
    expect(bookPageSize(1.4, false, { width: 390, height: 700 }, 28)).toEqual({
      width: 334,
      height: 467,
    });
  });

  it("o'lcham noma'lum bo'lsa 0", () => {
    expect(bookPageSize(1.4, true, { width: 0, height: 0 }, 28)).toEqual({ width: 0, height: 0 });
  });

  it("«Moslash» masshtabi: stage o'zgarsa kitob qayta chizilmaydi — ko'paytma o'zgaradi", () => {
    const book = { width: 1062, height: 743 };
    expect(fitScale(book, stage, 28)).toBeCloseTo(1, 2);
    // Mavzu paneli (480px) ochildi — kitob kichrayadi.
    expect(fitScale(book, { width: 720, height: 800 }, 28)).toBeCloseTo((720 - 56) / 1062, 5);
    expect(fitScale({ width: 0, height: 0 }, stage, 28)).toBe(1);
  });
});

describe("pan chegaralari", () => {
  const book = { width: 1000, height: 700 };
  const stage = { width: 1100, height: 800 };

  it("kitob stage'dan kichik bo'lsa pan yo'q (markazda)", () => {
    expect(panBounds(book, 1, stage, 28)).toEqual({ x: 0, y: 0 });
    expect(clampPan({ x: 300, y: -120 }, panBounds(book, 1, stage, 28))).toEqual({ x: 0, y: 0 });
  });

  it("300% da chegarada to'xtaydi: chetlar stage'dan butunlay chiqib ketmaydi", () => {
    const bounds = panBounds(book, 3, stage, 28);
    expect(bounds).toEqual({ x: (3000 - 1100) / 2 + 28, y: (2100 - 800) / 2 + 28 });
    expect(clampPan({ x: 5000, y: -5000 }, bounds)).toEqual({ x: bounds.x, y: -bounds.y });
    expect(clampPan({ x: 100, y: 50 }, bounds)).toEqual({ x: 100, y: 50 });
  });

  it("zoom fokus nuqtasi atrofida: nuqta ekranda joyida qoladi", () => {
    const pan = zoomAround({ x: 0, y: 0 }, { x: 100, y: 50 }, 1, 2);
    expect(pan).toEqual({ x: -100, y: -50 });
    // Kitobning fokusdagi nuqtasi: (focal − pan) / scale — oldin ham, keyin ham bir xil.
    expect((100 - pan.x) / 2).toBe(100);
    expect(zoomAround({ x: 40, y: 0 }, { x: 0, y: 0 }, 2, 1)).toEqual({ x: 20, y: 0 });
  });
});

describe("kitob qalinligi", () => {
  it("o'qilgan qism chapda qalinlashadi", () => {
    expect(stackDepths(1, 240)).toEqual({ left: 0, right: 10 });
    expect(stackDepths(120, 240).left).toBe(5);
    expect(stackDepths(240, 240)).toEqual({ left: 10, right: 0 });
    // Yupqa kitob — kamroq qatlam (kamida 2).
    expect(stackDepths(1, 20)).toEqual({ left: 0, right: 2 });
  });

  it("qatlamlar box-shadow ro'yxati, tomoniga qarab", () => {
    expect(stackShadow(0, 1)).toBe("");
    const shadow = stackShadow(2, -1);
    expect(shadow.split(", ")).toHaveLength(2);
    expect(shadow.startsWith("-1.5px")).toBe(true);
  });
});

describe("animatsiya va aniqlik", () => {
  it("harakat kamaytirilgan yoki sust qurilmada — oddiy crossfade", () => {
    expect(prefersSimpleFlip({ reducedMotion: true })).toBe(true);
    expect(prefersSimpleFlip({ reducedMotion: false, cores: 2 })).toBe(true);
    expect(prefersSimpleFlip({ reducedMotion: false, memory: 1 })).toBe(true);
    expect(prefersSimpleFlip({ reducedMotion: false, cores: 8, memory: 8 })).toBe(false);
    expect(prefersSimpleFlip({ reducedMotion: false })).toBe(false);
  });

  it("qayta chizish zichligi: dpr × zoom, canvas tomoni ≤ 4096px", () => {
    expect(renderPixelRatio(2, 1, { width: 500, height: 700 })).toBe(2);
    expect(renderPixelRatio(2, 2, { width: 500, height: 700 })).toBe(4);
    expect(renderPixelRatio(2, 3, { width: 500, height: 700 })).toBeCloseTo(4096 / 700, 5);
    expect(renderPixelRatio(1, 0.5, { width: 500, height: 700 })).toBe(1);
  });
});
