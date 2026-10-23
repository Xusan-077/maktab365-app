import { describe, expect, it } from "vitest";
import {
  chapterProblems,
  countRows,
  fromApi,
  moveItem,
  parseBulk,
  toPayload,
  withoutBlankRows,
  type ChapterDraft,
} from "./chapters";

const draft = (title: string, page: string, children: [string, string][] = []): ChapterDraft => ({
  key: `k-${title}`,
  title,
  page,
  children: children.map(([t, p]) => ({ key: `k-${t}`, title: t, page: p })),
});

describe("parseBulk", () => {
  it("nuqtali yetaklovchi bilan sarlavha va betni ajratadi", () => {
    const { rows, skipped } = parseBulk("1. Kirish ........ 5\n2. Algebra .... 12\n");
    expect(rows.map((r) => [r.title, r.page])).toEqual([
      ["1. Kirish", "5"],
      ["2. Algebra", "12"],
    ]);
    expect(skipped).toBe(0);
  });

  it.each([
    ["Kirish 5", "Kirish", "5"],
    ["Kirish\t7", "Kirish", "7"],
    ["Kirish — 9", "Kirish", "9"],
    ["Kirish: 10", "Kirish", "10"],
    ["Kirish … 011", "Kirish", "11"],
    ["Algebra 2024 .... 12", "Algebra 2024", "12"],
    ["  Kirish    3  ", "Kirish", "3"],
  ])("%j → %j / %s", (line, title, page) => {
    const { rows } = parseBulk(line);
    expect(rows).toHaveLength(1);
    expect([rows[0].title, rows[0].page]).toEqual([title, page]);
  });

  it("bet yo'q yoki sarlavha yo'q qatorlar o'tkazib yuboriladi va sanaladi", () => {
    const { rows, skipped } = parseBulk("Faqat sarlavha\n42\n\nTo'g'ri 3\nNol 0");
    expect(rows.map((r) => r.title)).toEqual(["To'g'ri"]);
    expect(skipped).toBe(3);
  });

  it("chekinish va 1.2 raqamlash — ichki bo'lim", () => {
    const { rows } = parseBulk("1. Kirish 1\n  Maqsad 2\n\tTuzilma 3\n1.3 Yana 4\n2. Algebra 5");
    expect(rows).toHaveLength(2);
    expect(rows[0].children.map((c) => c.title)).toEqual(["Maqsad", "Tuzilma", "1.3 Yana"]);
    expect(rows[1].children).toEqual([]);
  });

  it("ota bo'lim bo'lmasa ichki qator yuqori darajada qoladi", () => {
    expect(parseBulk("  Yetim 4").rows.map((r) => r.title)).toEqual(["Yetim"]);
  });

  it("Windows qator oxiri va bo'sh matn", () => {
    expect(parseBulk("A 1\r\nB 2").rows).toHaveLength(2);
    expect(parseBulk("")).toEqual({ rows: [], skipped: 0 });
  });
});

describe("toPayload / bo'sh qatorlar", () => {
  it("sonlarga aylantiradi, qirqadi va bo'sh qatorlarni tashlaydi", () => {
    const drafts = [
      draft(" Kirish ", "1", [
        ["Maqsad", "2"],
        ["", ""],
      ]),
      draft("", ""),
      draft("Algebra", "5"),
    ];
    expect(toPayload(drafts)).toEqual([
      { title: "Kirish", page: 1, children: [{ title: "Maqsad", page: 2 }] },
      { title: "Algebra", page: 5 },
    ]);
    expect(countRows(drafts)).toBe(3);
    expect(withoutBlankRows(drafts)).toHaveLength(2);
  });
});

describe("chapterProblems", () => {
  it("sarlavha, bet va PDF chegarasini tekshiradi", () => {
    const drafts = [
      draft("", "1"),
      draft("A", "x"),
      draft("B", "0"),
      draft("C", "11", [["D", "99"]]),
      draft("E", "10"),
    ];
    const problems = chapterProblems(drafts, 10);
    expect(problems.get("k-")).toBe("titleRequired");
    expect(problems.get("k-A")).toBe("pageInvalid");
    expect(problems.get("k-B")).toBe("pageInvalid");
    expect(problems.get("k-C")).toBe("pageExceeds");
    expect(problems.get("k-D")).toBe("pageExceeds");
    expect(problems.has("k-E")).toBe(false);
  });

  it("betlar soni noma'lum bo'lsa yuqori chegara yo'q", () => {
    expect(chapterProblems([draft("A", "5000")]).size).toBe(0);
    expect(chapterProblems([draft("A", "5000")], 0).size).toBe(0);
  });

  it("uzun sarlavha", () => {
    const long = "x".repeat(201);
    expect(chapterProblems([draft(long, "1")]).get(`k-${long}`)).toBe("titleTooLong");
  });
});

describe("moveItem", () => {
  it("o'rin almashtiradi, chegarada o'zgarmaydi, asl massivni buzmaydi", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(items, 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveItem(items, 0, -1)).toEqual(items);
    expect(moveItem(items, 2, 1)).toEqual(items);
    expect(items).toEqual(["a", "b", "c"]);
  });
});

describe("fromApi", () => {
  it("API daraxtini tahrirlanadigan qatorlarga aylantiradi", () => {
    const rows = fromApi([
      { id: "1", title: "Kirish", page: 1, children: [{ id: "2", title: "Maqsad", page: 2 }] },
      { id: "3", title: "Algebra", page: 5 },
    ]);
    expect(rows.map((r) => [r.title, r.page, r.children.length])).toEqual([
      ["Kirish", "1", 1],
      ["Algebra", "5", 0],
    ]);
    expect(new Set(rows.flatMap((r) => [r.key, ...r.children.map((c) => c.key)])).size).toBe(3);
  });
});
