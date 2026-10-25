import { describe, expect, it } from "vitest";
import {
  buildBookContents,
  contentsProgress,
  defaultOpenChapter,
  filterContents,
  highlightParts,
  practiceKind,
  toRoman,
  toSentenceCase,
} from "./book-contents";
import type { TocChapter } from "./toc";

const CHAPTERS: TocChapter[] = [
  { id: "rev", title: "8-sinfda o‘rganilgan mavzularni takrorlash", page: 3 },
  {
    id: "c1",
    title: "I bob. ALGEBRAIK IFODALAR",
    page: 5,
    children: [
      { id: "p1", title: "1-§. Ko‘phadlar", page: 6 },
      { id: "p2", title: "2-§. Kasrlar", page: 12 },
      { id: "x1", title: "Mashqlar", page: 18 },
      { id: "t1", title: "I bob bo‘yicha test", page: 19 },
    ],
  },
  {
    id: "c2",
    title: "II bob. Funksiyalar",
    page: 20,
    children: [
      { id: "p3", title: "3-§. Chiziqli funksiya", page: 21 },
      { id: "p4", title: "4-§. Kvadrat funksiyaga oid masalalar", page: 30 },
      { id: "a1", title: "Amaliy ish", page: 38 },
    ],
  },
  { id: "c3", title: "III bob. Tengsizliklar", page: 40, children: [] },
  { id: "app", title: "1-ilova. Jadvallar", page: 55 },
];

const contents = buildBookContents(CHAPTERS, 60);

describe("buildBookContents", () => {
  it("kirish, boblar va ilovani ajratadi; bob nomi prefiksiz va oddiy yozuvda", () => {
    expect(contents.intro.map((r) => r.id)).toEqual(["rev"]);
    expect(contents.appendix.map((r) => r.id)).toEqual(["app"]);
    expect(contents.chapters.map((c) => [c.roman, c.name])).toEqual([
      ["I", "Algebraik ifodalar"],
      ["II", "Funksiyalar"],
      ["III", "Tengsizliklar"],
    ]);
  });

  it("bob oralig'i: keyingi bob boshigacha; oxirgi bob ilovagacha yoki kitob oxirigacha", () => {
    expect(contents.chapters.map((c) => [c.startPage, c.endPage])).toEqual([
      [5, 19],
      [20, 39],
      [40, 54],
    ]);
    const noAppendix = buildBookContents(CHAPTERS.slice(0, 4), 60);
    expect(noAppendix.chapters.at(-1)?.endPage).toBe(60);
  });

  it("mashq/test/amaliy qatorlar paragraf emas; § li sarlavha doim paragraf", () => {
    const [c1, c2] = contents.chapters;
    expect(c1.paragraphs.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(c1.practice.map((p) => [p.id, p.kind])).toEqual([
      ["x1", "exercise"],
      ["t1", "test"],
    ]);
    expect(c2.paragraphs.map((p) => p.id)).toEqual(["p3", "p4"]);
    expect(c2.practice.map((p) => p.kind)).toEqual(["project"]);
    expect(c1.paragraphs[0]).toMatchObject({ label: "1-§", name: "Ko‘phadlar", endPage: 11 });
    // Oxirgi paragraf bob oxirigacha (mashqlar sahifalari ham uning ichida).
    expect(c1.paragraphs[1].endPage).toBe(19);
  });

  it("bob raqami yo'q bo'lsa tartib bo'yicha rim raqami", () => {
    const built = buildBookContents(
      [{ id: "x", title: "Sonlar", page: 1, children: [{ id: "y", title: "1-§. A", page: 2 }] }],
      10,
    );
    expect(built.chapters[0].roman).toBe("I");
  });
});

describe("contentsProgress", () => {
  it("bo'sh o'qish: hammasi kutayotgan, 0%; birinchi bob ochiq", () => {
    const progress = contentsProgress(contents, null);
    expect(progress.currentParagraphId).toBeNull();
    expect(progress.doneCount).toBe(0);
    expect(progress.percent).toBe(0);
    expect([...progress.paragraphs.values()].every((s) => s === "pending")).toBe(true);
    expect(defaultOpenChapter(contents, progress)).toBe("c1");
  });

  it("joriy paragraf, tugatilganlar va bob foizi", () => {
    const progress = contentsProgress(contents, 25);
    expect(progress.currentParagraphId).toBe("p3");
    expect(progress.paragraphs.get("p1")).toBe("done");
    expect(progress.paragraphs.get("p2")).toBe("done");
    expect(progress.paragraphs.get("p4")).toBe("pending");
    expect(progress.doneCount).toBe(2);
    expect(progress.chapters.get("c1")).toEqual({ state: "done", percent: 100 });
    // II bob: 20..39 (20 bet), 25 gacha 6 bet o'qilgan.
    expect(progress.chapters.get("c2")).toEqual({ state: "inProgress", percent: 30 });
    expect(progress.chapters.get("c3")?.state).toBe("unread");
    expect(progress.percent).toBe(42);
    expect(defaultOpenChapter(contents, progress)).toBe("c2");
  });

  it("paragrafning oxirgi betidan o'tilsa tugatilgan; kirish sahifasidagi o'qish — joriy paragraf yo'q", () => {
    expect(contentsProgress(contents, 12).paragraphs.get("p1")).toBe("done");
    const intro = contentsProgress(contents, 4);
    expect(intro.currentParagraphId).toBeNull();
    expect(intro.currentChapterId).toBeNull();
    expect(defaultOpenChapter(contents, intro)).toBe("c1");
  });

  it("oxirgi bob va kitob oxiri: hammasi tugatilgan", () => {
    const last = contentsProgress(contents, 45);
    expect(last.chapters.get("c3")).toEqual({ state: "inProgress", percent: 40 });
    const done = contentsProgress(contents, 60);
    expect(done.finished).toBe(true);
    expect(done.doneCount).toBe(4);
    expect(done.chapters.get("c3")?.state).toBe("done");
    expect(done.percent).toBe(100);
  });
});

describe("filterContents", () => {
  const progress = contentsProgress(contents, 25);

  it("qidiruv: mos qatorlar; bob nomi mos kelsa butun bob", () => {
    const byParagraph = filterContents(contents, progress, "kasr", "all");
    expect(byParagraph.chapters.map((c) => c.paragraphs.map((p) => p.id))).toEqual([["p2"]]);
    expect(byParagraph.count).toBe(1);
    const byChapter = filterContents(contents, progress, "funksiyalar", "all");
    expect(byChapter.chapters[0].paragraphs).toHaveLength(2);
    expect(filterContents(contents, progress, "takrorlash", "all").intro).toHaveLength(1);
  });

  it("filtrlar qidiruv bilan birga", () => {
    expect(
      filterContents(contents, progress, "", "inProgress").chapters.map((c) => c.chapter.id),
    ).toEqual(["c2"]);
    const unread = filterContents(contents, progress, "", "unread");
    expect(unread.chapters.flatMap((c) => c.paragraphs.map((p) => p.id))).toEqual(["p3", "p4"]);
    const tests = filterContents(contents, progress, "", "tests");
    expect(tests.chapters.flatMap((c) => c.practice.map((p) => p.id))).toEqual(["x1", "t1", "a1"]);
    expect(tests.intro).toEqual([]);
    expect(filterContents(contents, progress, "kasr", "tests").count).toBe(0);
  });
});

describe("yordamchilar", () => {
  it("highlightParts: katta-kichik harf va tutuq belgisisiz", () => {
    expect(highlightParts("1-§. Ko‘phadlar", "kop")).toEqual([
      { text: "1-§. ", match: false },
      { text: "Ko‘p", match: true },
      { text: "hadlar", match: false },
    ]);
    expect(highlightParts("Kasrlar", "")).toEqual([{ text: "Kasrlar", match: false }]);
  });

  it("toRoman, toSentenceCase, practiceKind", () => {
    expect([1, 4, 9, 14].map(toRoman)).toEqual(["I", "IV", "IX", "XIV"]);
    expect(toSentenceCase("KASRLAR VA ULAR")).toBe("Kasrlar va ular");
    expect(toSentenceCase("Kasrlar")).toBe("Kasrlar");
    expect(practiceKind("Nazorat ishi")).toBe("test");
    expect(practiceKind("Kasrlar")).toBeNull();
  });
});
