import { describe, expect, it } from "vitest";
import { currentTocItem, flattenToc, type TocChapter } from "./toc";

const chapters: TocChapter[] = [
  {
    id: "a",
    title: "Kirish",
    page: 1,
    children: [
      { id: "a1", title: "Maqsad", page: 2 },
      { id: "a2", title: "Tuzilma", page: 5 },
    ],
  },
  { id: "b", title: "Algebra", page: 5 },
  { id: "c", title: "Geometriya", page: 20 },
];

describe("flattenToc", () => {
  it("hujjat tartibi va darajalarni saqlaydi", () => {
    expect(flattenToc(chapters).map((item) => [item.id, item.level])).toEqual([
      ["a", 0],
      ["a1", 1],
      ["a2", 1],
      ["b", 0],
      ["c", 0],
    ]);
  });

  it("bo'sh mundarija", () => {
    expect(flattenToc([])).toEqual([]);
  });
});

describe("currentTocItem", () => {
  const items = flattenToc(chapters);
  const at = (page: number) => currentTocItem(items, page)?.id ?? null;

  it("sahifaga eng yaqin oldingi bo'lim", () => {
    expect(at(1)).toBe("a");
    expect(at(3)).toBe("a1");
    expect(at(19)).toBe("b");
    expect(at(20)).toBe("c");
    expect(at(300)).toBe("c");
  });

  it("sahifalar teng bo'lsa keyingi qator tanlanadi", () => {
    expect(at(5)).toBe("b");
  });

  it("birinchi bo'limdan oldingi sahifada bo'lim yo'q", () => {
    const late = flattenToc([{ id: "x", title: "X", page: 4 }]);
    expect(currentTocItem(late, 2)).toBeNull();
    expect(currentTocItem([], 1)).toBeNull();
  });
});

describe("flattenToc: prezentatsiya", () => {
  it("bo'lim va ichki bo'limdagi prezentatsiya ma'lumoti saqlanadi, yo'q bo'lsa null", () => {
    const slides = { page_count: 12, size_bytes: 2048 };
    const items = flattenToc([
      {
        id: "a",
        title: "Kirish",
        page: 1,
        slides,
        children: [
          { id: "a1", title: "Maqsad", page: 2, slides: null },
          { id: "a2", title: "T", page: 3 },
        ],
      },
      { id: "b", title: "Algebra", page: 5 },
    ]);

    expect(items.map((item) => [item.id, item.slides])).toEqual([
      ["a", slides],
      ["a1", null],
      ["a2", null],
      ["b", null],
    ]);
  });
});
