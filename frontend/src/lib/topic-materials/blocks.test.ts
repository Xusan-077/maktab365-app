import { describe, expect, it } from "vitest";
import { emptyBlock, hasContent, parseBlocks, SUMMARY_BLOCK_TYPES } from "./blocks";
import { presentationFileProblem, slideIndexParam, toSlidePatches, visibleSlides } from "./slides";
import type { Slide } from "./types";

describe("parseBlocks", () => {
  it("noma'lum tip va noto'g'ri shakl jim tashlanadi, maydonlar normallashadi", () => {
    expect(
      parseBlocks([
        { type: "idea", title: "G‘oya", text: "Matn", extra: 1 },
        { type: "video", url: "x" },
        null,
        { type: "chips", label: "Kalit", items: ["a", 2, "b"] },
        { type: "bullets", items: [{ lead: "L", text: "T" }, "x"] },
      ]),
    ).toEqual([
      { type: "idea", title: "G‘oya", text: "Matn" },
      { type: "chips", label: "Kalit", items: ["a", "b"] },
      { type: "bullets", items: [{ lead: "L", text: "T" }] },
    ]);
    expect(parseBlocks("x")).toEqual([]);
  });

  it("har tip uchun bo'sh blok — bo'sh hisoblanadi", () => {
    for (const type of SUMMARY_BLOCK_TYPES) {
      expect(emptyBlock(type).type).toBe(type);
      expect(hasContent(emptyBlock(type))).toBe(false);
    }
    expect(hasContent({ type: "example", text: " x " })).toBe(true);
  });
});

const slide = (id: string, order: number, hidden = false): Slide => ({
  id,
  order,
  hidden,
  image_url: "",
  thumb_url: "",
  alt: "",
  note: null,
});

describe("slides", () => {
  it("o'quvchiga faqat ko'rinadiganlari, tartib bo'yicha", () => {
    expect(
      visibleSlides([slide("c", 3), slide("a", 1), slide("b", 2, true)]).map((s) => s.id),
    ).toEqual(["a", "c"]);
  });

  it("?slayd= → indeks, chegarada", () => {
    expect(slideIndexParam("4", 12)).toBe(3);
    expect(slideIndexParam("99", 12)).toBe(11);
    expect(slideIndexParam("x", 12)).toBe(0);
    expect(slideIndexParam("2", 0)).toBe(0);
  });

  it("PATCH tanasi: tartib 1..N, eslatma bo'sh satr", () => {
    expect(toSlidePatches([slide("b", 5), slide("a", 2, true)])).toEqual([
      { id: "b", order: 1, hidden: false, note: "", alt: "" },
      { id: "a", order: 2, hidden: true, note: "", alt: "" },
    ]);
  });

  it("fayl: faqat PPTX/PDF, bo'sh emas, 25 MB gacha", () => {
    expect(presentationFileProblem({ name: "dars.PPTX", size: 10 })).toBeNull();
    expect(presentationFileProblem({ name: "dars.pdf", size: 25 * 1024 * 1024 })).toBeNull();
    expect(presentationFileProblem({ name: "dars.key", size: 10 })).toBe("type");
    expect(presentationFileProblem({ name: "dars.pdf", size: 0 })).toBe("empty");
    expect(presentationFileProblem({ name: "dars.pdf", size: 25 * 1024 * 1024 + 1 })).toBe("size");
  });
});
