import { describe, expect, it } from "vitest";
import {
  clampFontSize,
  currentChapter,
  DEFAULT_BOOK_PREFS,
  effectiveView,
  pagesToPrefetch,
  progressPercent,
  resumeState,
  sanitizeBookPrefs,
  splitMatches,
  stepFontSize,
  stepPage,
  toParagraphs,
} from "./reader";

describe("progressPercent / resumeState", () => {
  it("foizni 0–100 oralig'ida yaxlitlaydi", () => {
    expect(progressPercent(45, 320)).toBe(14);
    expect(progressPercent(400, 320)).toBe(100);
    expect(progressPercent(5, 0)).toBe(0);
  });

  it("boshlanmagan, davom etayotgan va tugagan holatlarni ajratadi", () => {
    expect(resumeState(null, 100)).toBe("start");
    expect(resumeState(1, 100)).toBe("start");
    expect(resumeState(45, 100)).toBe("continue");
    expect(resumeState(100, 100)).toBe("finished");
  });
});

describe("currentChapter", () => {
  const chapters = [
    { start_page: 1, title: "Kirish" },
    { start_page: 10, title: "I bob" },
    { start_page: 30, title: "II bob" },
  ];

  it("bet boshlanishi shu betdan oshmagan oxirgi bo'limni qaytaradi", () => {
    expect(currentChapter(chapters, 1)?.title).toBe("Kirish");
    expect(currentChapter(chapters, 29)?.title).toBe("I bob");
    expect(currentChapter(chapters, 30)?.title).toBe("II bob");
  });

  it("bo'limsiz kitobda yoki birinchi bo'limdan oldin null", () => {
    expect(currentChapter([], 5)).toBeNull();
    expect(currentChapter([{ start_page: 3, title: "X" }], 2)).toBeNull();
  });
});

describe("pagesToPrefetch / stepPage", () => {
  it("keyingi ikki betni oladi va jamidan oshmaydi", () => {
    expect(pagesToPrefetch(5, 20)).toEqual([6, 7]);
    expect(pagesToPrefetch(19, 20)).toEqual([20]);
    expect(pagesToPrefetch(20, 20)).toEqual([]);
  });

  it("qadam chegaradan chiqmaydi", () => {
    expect(stepPage(1, 10, -1)).toBe(1);
    expect(stepPage(10, 10, 1)).toBe(10);
    expect(stepPage(4, 10, 1)).toBe(5);
  });
});

describe("ko'rinish sozlamalari", () => {
  it("yaroqsiz qiymatlar standartga qaytadi", () => {
    expect(sanitizeBookPrefs({ theme: "x", fontSize: "big", lineHeight: 9, view: 3 })).toEqual(
      DEFAULT_BOOK_PREFS,
    );
    expect(sanitizeBookPrefs(null)).toEqual(DEFAULT_BOOK_PREFS);
  });

  it("yaroqli qiymatlar saqlanadi, shrift hajmi chegaralanadi", () => {
    const prefs = sanitizeBookPrefs({ theme: "night", font: "sans", fontSize: 99, lineHeight: 2 });
    expect(prefs).toMatchObject({ theme: "night", font: "sans", fontSize: 30, lineHeight: 2 });
    expect(clampFontSize(3)).toBe(14);
    expect(stepFontSize(20, 1)).toBe(22);
    expect(stepFontSize(30, 1)).toBe(30);
  });

  it("matn rejimi faqat matn bor kitobda", () => {
    expect(effectiveView("text", true)).toBe("text");
    expect(effectiveView("text", false)).toBe("page");
    expect(effectiveView("page", true)).toBe("page");
  });
});

describe("toParagraphs", () => {
  it("bo'sh qator — yangi xatboshi, qator sinishi — bo'shliq", () => {
    expect(toParagraphs("Bir\nikki\n\n  Uch  \n\n\n")).toEqual(["Bir ikki", "Uch"]);
    expect(toParagraphs("")).toEqual([]);
  });
});

describe("splitMatches", () => {
  it("mosliklarni katta-kichik harfga e'tiborsiz ajratadi", () => {
    expect(splitMatches("Kitob KITOB va kitoblar", "kitob")).toEqual([
      { text: "Kitob", match: true },
      { text: " ", match: false },
      { text: "KITOB", match: true },
      { text: " va ", match: false },
      { text: "kitob", match: true },
      { text: "lar", match: false },
    ]);
  });

  it("moslik yo'q yoki so'rov bo'sh bo'lsa butun matn", () => {
    expect(splitMatches("abc", "x")).toEqual([{ text: "abc", match: false }]);
    expect(splitMatches("abc", " ")).toEqual([{ text: "abc", match: false }]);
  });
});
