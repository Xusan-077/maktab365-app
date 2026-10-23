import { describe, expect, it, vi } from "vitest";
import {
  indexesOf,
  matchRects,
  normalizeText,
  pageHit,
  SCAN_PROBE_PAGES,
  searchDocument,
  type FindableDocument,
} from "./find";

const doc = (pages: string[]): FindableDocument => ({
  numPages: pages.length,
  getPage: async (n) => ({
    getTextContent: async () => ({
      items: pages[n - 1].split("|").map((str) => ({ str })),
    }),
  }),
});

describe("normalize / indexesOf", () => {
  it("katta-kichik harf va bo'shliqlarga e'tiborsiz", () => {
    expect(normalizeText("  Kvadrat\n  FUNKSIYA ")).toBe(" kvadrat funksiya ");
  });
  it("kesishmaydigan moslashuvlar", () => {
    expect(indexesOf("aaaa", "aa")).toEqual([0, 2]);
    expect(indexesOf("abc", "")).toEqual([]);
    expect(indexesOf("abc", "d")).toEqual([]);
  });
});

describe("pageHit", () => {
  it("birinchi moslashuv atrofidagi snippet va soni", () => {
    const hit = pageHit(3, "Kvadrat funksiya va kvadrat tenglama", "KVADRAT")!;
    expect(hit).toMatchObject({ page: 3, count: 2, match: "kvadrat" });
    expect(hit.before).toBe("");
    expect(hit.after).toContain("funksiya");
  });
  it("uzun matnda ellipsis", () => {
    const hit = pageHit(1, `${"a ".repeat(60)}x${" b".repeat(60)}`, "x")!;
    expect(hit.before.startsWith("…")).toBe(true);
    expect(hit.after.endsWith("…")).toBe(true);
  });
  it("topilmasa null", () => {
    expect(pageHit(1, "salom", "xyz")).toBeNull();
  });
});

describe("searchDocument", () => {
  it("sahifalar bo'ylab topadi va progress beradi", async () => {
    const progress = vi.fn();
    const result = await searchDocument(
      doc(["algebra", "geometriya|algebra", "fizika"]),
      "algebra",
      {
        onProgress: progress,
      },
    );
    expect(result.hits.map((h) => h.page)).toEqual([1, 2]);
    expect(result).toMatchObject({ complete: true, scanned: false });
    expect(progress).toHaveBeenCalledTimes(3);
  });

  it("skaner PDF (matn yo'q) uchun scanned", async () => {
    const pages = Array.from({ length: 30 }, () => "");
    const result = await searchDocument(doc(pages), "algebra");
    expect(result.scanned).toBe(true);
    expect(result.hits).toEqual([]);
    expect(result.complete).toBe(false); // SCAN_PROBE_PAGES dan keyin to'xtaydi
    expect(SCAN_PROBE_PAGES).toBeLessThan(30);
  });

  it("matn bor, lekin so'z yo'q — scanned emas", async () => {
    const result = await searchDocument(doc(["salom", "dunyo"]), "algebra");
    expect(result).toMatchObject({ hits: [], complete: true, scanned: false });
  });

  it("signal bekor qilinsa to'xtaydi", async () => {
    const controller = new AbortController();
    const result = await searchDocument(doc(["a", "a", "a"]), "a", {
      signal: controller.signal,
      onProgress: (page) => page === 1 && controller.abort(),
    });
    expect(result.hits).toHaveLength(1);
    expect(result.complete).toBe(false);
  });
});

describe("matchRects", () => {
  // PDF (0,0) pastki chap; viewport: y pastdan tepaga teskari, 1:1 masshtab, sahifa 100×200.
  const toViewport = ([x1, y1, x2, y2]: [number, number, number, number]) => [
    x1,
    200 - y1,
    x2,
    200 - y2,
  ];
  const item = {
    str: "Kvadrat tenglama",
    transform: [10, 0, 0, 10, 20, 100],
    width: 80,
    height: 10,
  };

  it("so'z o'rnini matn bo'lagi ichida nisbatan hisoblaydi (0..1)", () => {
    const [rect] = matchRects([item], "tenglama", toViewport, 100, 200);
    // 'tenglama' 8-belgidan boshlanadi: x = 20 + 8/16*80 = 60
    expect(rect.x).toBeCloseTo(0.6);
    expect(rect.w).toBeCloseTo(0.4);
    expect(rect.y).toBeGreaterThan(0);
    expect(rect.h).toBeGreaterThan(0);
  });
  it("bo'sh so'z, nol o'lcham va belgilar soni o'zgargan matnda bo'sh", () => {
    expect(matchRects([item], "", toViewport, 100, 200)).toEqual([]);
    expect(matchRects([item], "x", toViewport, 0, 200)).toEqual([]);
    expect(matchRects([{ ...item, str: "İ" }], "i", toViewport, 100, 200)).toEqual([]);
  });
});
