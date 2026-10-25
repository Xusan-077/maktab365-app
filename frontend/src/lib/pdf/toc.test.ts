import { describe, expect, it } from "vitest";
import {
  currentTocItem,
  currentTocGroupId,
  filterTocGroups,
  flattenToc,
  groupToc,
  sectionLabel,
  tocMarkers,
  tocRowCount,
  tocStatuses,
  type TocChapter,
  type TocGroup,
} from "./toc";

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

const BOOK: TocChapter[] = [
  { id: "intro", title: "Kirish", page: 3 },
  {
    id: "b1",
    title: "I bob. Algebraik ifodalar",
    page: 5,
    children: [
      { id: "s1", title: "1-§. Ko'phadlar", page: 6 },
      { id: "s2", title: "2-§. Kasrlar", page: 12 },
    ],
  },
  {
    id: "b2",
    title: "II bob. Funksiyalar",
    page: 20,
    children: [{ id: "s3", title: "3-§. Chiziqli funksiya", page: 21 }],
  },
];

describe("groupToc", () => {
  it("boblar bo'yicha guruhlaydi (bo'limsiz bob — bo'sh guruh)", () => {
    const groups = groupToc(BOOK);
    expect(groups.map((g) => [g.chapter.title, g.sections.map((s) => s.id)])).toEqual([
      ["Kirish", []],
      ["I bob. Algebraik ifodalar", ["s1", "s2"]],
      ["II bob. Funksiyalar", ["s3"]],
    ]);
    expect(groups[1].sections[0].level).toBe(1);
    expect(tocRowCount(groups)).toBe(6);
  });
});

describe("currentTocGroupId", () => {
  it("joriy bo'lim joylashgan bob", () => {
    const groups = groupToc(BOOK);
    expect(currentTocGroupId(groups, 13)).toBe("b1");
    expect(currentTocGroupId(groups, 5)).toBe("b1");
    expect(currentTocGroupId(groups, 25)).toBe("b2");
    expect(currentTocGroupId(groups, 3)).toBe("intro");
    expect(currentTocGroupId(groups, 1)).toBeNull();
    expect(currentTocGroupId(groups, null)).toBeNull();
  });
});

describe("filterTocGroups", () => {
  const groups = groupToc(BOOK);
  const shape = (list: readonly TocGroup[]) =>
    list.map((g) => [g.chapter.id, g.sections.map((s) => s.id)]);

  it("bo'lim topilsa — shu bob va faqat mos bo'limlar", () => {
    expect(shape(filterTocGroups(groups, "kasr"))).toEqual([["b1", ["s2"]]]);
  });

  it("bob nomi mos kelsa — butun bob", () => {
    expect(shape(filterTocGroups(groups, "funksiyalar"))).toEqual([["b2", ["s3"]]]);
  });

  it("katta-kichik harf, tutuq belgisi va kirill yozuvi farq qilmaydi", () => {
    expect(shape(filterTocGroups(groups, "KOPHAD"))).toEqual([["b1", ["s1"]]]);
    expect(shape(filterTocGroups(groups, "кўпҳад"))).toEqual([["b1", ["s1"]]]);
  });

  it("bo'sh so'rov — hammasi, mos kelmasa — bo'sh", () => {
    expect(filterTocGroups(groups, "  ")).toBe(groups);
    expect(filterTocGroups(groups, "geometriya")).toEqual([]);
  });
});

describe("tocStatuses / sectionLabel / tocMarkers", () => {
  const book: TocChapter[] = [
    {
      id: "b1",
      title: "I bob",
      page: 3,
      children: [
        { id: "s1", title: "1-§. Ko'phad", page: 3 },
        { id: "s2", title: "2-§. Kasr", page: 10 },
      ],
    },
    {
      id: "b2",
      title: "II bob",
      page: 20,
      children: [{ id: "s3", title: "§ 3 Funksiya", page: 20 }],
    },
  ];
  const groups = groupToc(book);

  it("joriy bo'limdan oldingilari o'qilgan, keyingilari o'qilmagan; bob joriy bo'lim bilan", () => {
    const statuses = tocStatuses(groups, 12);
    expect(Object.fromEntries(statuses)).toEqual({
      b1: "current",
      s1: "read",
      s2: "current",
      b2: "unread",
      s3: "unread",
    });
    expect(tocStatuses(groups, 25).get("b1")).toBe("read");
    expect(tocStatuses(groups, 1).get("s1")).toBe("unread");
  });

  it("sarlavhadan «N-§» belgisi", () => {
    expect(sectionLabel("15-§. Kvadrat tenglama")).toBe("15-§");
    expect(sectionLabel("§ 3 Funksiya")).toBe("3-§");
    expect(sectionLabel("Kirish")).toBeNull();
  });

  it("slider belgilari: 1-betdagi va takror betlar chiqmaydi, ulush 0..1", () => {
    const markers = tocMarkers(flattenToc(book), 21);
    expect(markers.map((m) => [m.id, m.page, m.at])).toEqual([
      ["b1", 3, 0.1],
      ["s2", 10, 0.45],
      ["b2", 20, 0.95],
    ]);
    expect(tocMarkers(flattenToc(book), 1)).toEqual([]);
  });
});
