import { describe, expect, it } from "vitest";
import type { PageEntry } from "./api";
import {
  activeEntryFilterCount,
  effectiveQuery,
  entryKey,
  entryQuery,
  groupEntriesByBook,
  isEntryEmpty,
  parseEntryFilters,
  summarizeEntry,
  toEntriesApiParams,
  withHighlightColor,
  withoutAnnotation,
} from "./entries";

const BOOK_A = "11111111-1111-4111-8111-111111111111";
const BOOK_B = "22222222-2222-4222-8222-222222222222";

const entry = (over: Partial<PageEntry> & { bookId?: string } = {}): PageEntry => ({
  book: { id: over.bookId ?? BOOK_A, title: "Kitob", cover: null as unknown as string },
  page: over.page ?? 1,
  image: null,
  note: "",
  note_updated_at: null,
  annotations: [],
  bookmarked: false,
  updated_at: "2026-10-31T10:00:00Z",
  ...over,
});

const highlight = (id: string, color: string) => ({
  id,
  type: "highlight" as const,
  data: { color, rects: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.05 }] },
  updated_at: "",
});

describe("parseEntryFilters / entryQuery", () => {
  it("URL'dan filtrni o'qiydi va qaytib yozadi", () => {
    const filters = parseEntryFilters(
      new URLSearchParams(`kitob=${BOOK_A}&tur=highlight&rang=%23FDE047&q=%20fotosintez%20`),
    );
    expect(filters).toEqual({ book: BOOK_A, type: "highlight", color: "#fde047", q: "fotosintez" });
    expect(entryQuery(filters)).toBe(`kitob=${BOOK_A}&tur=highlight&rang=%23fde047&q=fotosintez`);
  });

  it("noto'g'ri qiymatlar jim tashlanadi", () => {
    expect(parseEntryFilters({ kitob: "x", tur: "sticker", rang: "red" })).toEqual({
      book: undefined,
      type: undefined,
      color: undefined,
      q: undefined,
    });
  });

  it("rang faqat belgilash (yoki tur tanlanmagan) bilan olinadi", () => {
    expect(parseEntryFilters({ tur: "note", rang: "#fde047" }).color).toBeUndefined();
    expect(parseEntryFilters({ rang: "#fde047" }).color).toBe("#fde047");
  });

  it("massiv qiymatning birinchisi olinadi va bo'sh filtr bo'sh query beradi", () => {
    expect(parseEntryFilters({ tur: ["text", "note"] }).type).toBe("text");
    expect(entryQuery({})).toBe("");
  });

  it("faol filtrlar soni", () => {
    expect(activeEntryFilterCount({})).toBe(0);
    expect(activeEntryFilterCount({ book: BOOK_A, q: "a" })).toBe(2);
  });
});

describe("qidiruv va API parametrlari", () => {
  it("1 belgi yuborilmaydi, bo'shliqlar olib tashlanadi", () => {
    expect(effectiveQuery("a")).toBeUndefined();
    expect(effectiveQuery("  ab ")).toBe("ab");
    expect(toEntriesApiParams({ q: "x", type: "note" }, 2)).toMatchObject({
      q: undefined,
      type: "note",
      page: 2,
      page_size: 20,
    });
  });
});

describe("groupEntriesByBook", () => {
  it("kitoblar birinchi uchragan tartibda, betlar o'z tartibida; sahifa chegarasida ham birlashadi", () => {
    const groups = groupEntriesByBook([
      entry({ bookId: BOOK_B, page: 1 }),
      entry({ bookId: BOOK_A, page: 2 }),
      entry({ bookId: BOOK_A, page: 5 }),
      entry({ bookId: BOOK_B, page: 9 }),
    ]);
    expect(groups.map((group) => group.book.id)).toEqual([BOOK_B, BOOK_A]);
    expect(groups[0]!.entries.map((item) => item.page)).toEqual([1, 9]);
    expect(groups[1]!.entries.map((item) => item.page)).toEqual([2, 5]);
  });

  it("bo'sh ro'yxat", () => {
    expect(groupEntriesByBook([])).toEqual([]);
  });

  it("kalit kitob va bet bo'yicha", () => {
    expect(entryKey(entry({ page: 4 }))).toBe(`${BOOK_A}:4`);
  });
});

describe("summarizeEntry / isEntryEmpty", () => {
  it("turlar bo'yicha sanaydi, ranglar takrorsiz", () => {
    const summary = summarizeEntry(
      entry({
        note: " matn ",
        bookmarked: true,
        annotations: [
          highlight("a", "#fde047"),
          highlight("b", "#fde047"),
          highlight("c", "#86efac"),
          { id: "d", type: "drawing", data: {}, updated_at: "" },
          { id: "t", type: "text", data: {}, updated_at: "" },
          { id: "s", type: "solution", data: {}, updated_at: "" },
        ],
      }),
    );
    expect(summary).toEqual({
      highlights: 3,
      drawings: 1,
      texts: 1,
      solutions: 1,
      hasNote: true,
      bookmarked: true,
      colors: ["#fde047", "#86efac"],
    });
  });

  it("yozuv bo'shmi", () => {
    expect(isEntryEmpty(entry())).toBe(true);
    expect(isEntryEmpty(entry({ note: "  " }))).toBe(true);
    expect(isEntryEmpty(entry({ bookmarked: true }))).toBe(false);
    expect(isEntryEmpty(entry({ annotations: [highlight("a", "#fde047")] }))).toBe(false);
  });
});

describe("optimistik o'zgarishlar", () => {
  const base = entry({ annotations: [highlight("a", "#fde047"), highlight("b", "#86efac")] });

  it("rangni almashtiradi, qolgan maydonlar va boshqa belgilar o'zgarmaydi", () => {
    const next = withHighlightColor(base, "a", "#f9a8d4");
    expect((next.annotations[0]!.data as { color: string; rects: unknown[] }).color).toBe(
      "#f9a8d4",
    );
    expect((next.annotations[0]!.data as { rects: unknown[] }).rects).toHaveLength(1);
    expect(next.annotations[1]).toBe(base.annotations[1]);
    expect(base.annotations[0]!.data).toMatchObject({ color: "#fde047" });
  });

  it("belgini olib tashlaydi", () => {
    expect(withoutAnnotation(base, "a").annotations.map((item) => item.id)).toEqual(["b"]);
  });
});
