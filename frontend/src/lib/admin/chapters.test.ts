import { describe, expect, it } from "vitest";
import {
  chapterProblems,
  countRows,
  emptyRow,
  fromApi,
  indentRow,
  moveItem,
  outdentRow,
  parseBulk,
  slidesById,
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
      {
        id: "1",
        title: "Kirish",
        page: 1,
        slides: null,
        children: [{ id: "2", title: "Maqsad", page: 2, slides: null }],
      },
      { id: "3", title: "Algebra", page: 5, slides: null },
    ]);
    expect(rows.map((r) => [r.title, r.page, r.children.length])).toEqual([
      ["Kirish", "1", 1],
      ["Algebra", "5", 0],
    ]);
    expect(new Set(rows.flatMap((r) => [r.key, ...r.children.map((c) => c.key)])).size).toBe(3);
  });
});

describe("saqlangan bo'limlar: id va prezentatsiya", () => {
  const api = [
    {
      id: "c1",
      title: "Kirish",
      page: 1,
      slides: { name: "a.pdf", page_count: 4, size_bytes: 10, updated_at: null },
      children: [{ id: "c1a", title: "Maqsad", page: 2, slides: null }],
    },
    { id: "c2", title: "Algebra", page: 5, slides: null },
  ];

  it("fromApi id'ni saqlaydi, toPayload uni qaytarib yuboradi (prezentatsiya yo'qolmasin)", () => {
    expect(toPayload(fromApi(api))).toEqual([
      { id: "c1", title: "Kirish", page: 1, children: [{ id: "c1a", title: "Maqsad", page: 2 }] },
      { id: "c2", title: "Algebra", page: 5 },
    ]);
  });

  it("yangi (saqlanmagan) qator id siz ketadi", () => {
    const drafts = [...fromApi(api), { ...emptyRow(), title: "Yangi", page: "9", children: [] }];
    expect(toPayload(drafts).at(-1)).toEqual({ title: "Yangi", page: 9 });
  });

  it("slidesById: bo'lim va ichki bo'lim bo'yicha prezentatsiya", () => {
    const map = slidesById(api);
    expect(map.get("c1")?.page_count).toBe(4);
    expect(map.get("c1a")).toBeNull();
    expect(map.get("c2")).toBeNull();
    expect(map.size).toBe(3);
  });
});

describe("chapterProblems: bet tartibi", () => {
  it("218 → 214 → 216: kichraygan qator (214) xato, keyingisi unga nisbatan tekshiriladi", () => {
    const problems = chapterProblems(
      [draft("A", "218"), draft("B", "214"), draft("C", "216")],
      300,
    );
    expect(problems.get("k-B")).toBe("pageOrder");
    expect(problems.has("k-A")).toBe(false);
    expect(problems.has("k-C")).toBe(false);
  });

  it("hujjat tartibida: bob → uning bo'limlari → keyingi bob; teng bet mumkin", () => {
    const ok = [
      draft("I", "5", [
        ["1", "5"],
        ["2", "7"],
      ]),
      draft("II", "7", [["3", "9"]]),
    ];
    expect(chapterProblems(ok, 20).size).toBe(0);
    const childBefore = [draft("I", "5", [["1", "4"]])];
    expect(chapterProblems(childBefore, 20).get("k-1")).toBe("pageOrder");
    const nextBefore = [draft("I", "5", [["1", "9"]]), draft("II", "8")];
    expect(chapterProblems(nextBefore, 20).get("k-II")).toBe("pageOrder");
  });

  it("noto'g'ri yoki chegaradan oshgan bet tartibga ta'sir qilmaydi", () => {
    const problems = chapterProblems([draft("A", "3"), draft("B", "99"), draft("C", "4")], 10);
    expect(problems.get("k-B")).toBe("pageExceeds");
    expect(problems.has("k-C")).toBe(false);
  });
});

describe("indentRow / outdentRow (bob ↔ bo'lim)", () => {
  const titles = (drafts: ChapterDraft[]) =>
    drafts.map((d) => [d.title, d.children.map((c) => c.title)]);

  it("indent: yuqori qator oldingi bobning oxirgi bo'limi bo'ladi, o'z bo'limlari ham ko'chadi", () => {
    const drafts = [draft("I", "1", [["a", "2"]]), draft("b", "3", [["c", "4"]]), draft("II", "5")];
    expect(titles(indentRow(drafts, 1))).toEqual([
      ["I", ["a", "b", "c"]],
      ["II", []],
    ]);
  });

  it("birinchi qatorni indent qilib bo'lmaydi", () => {
    const drafts = [draft("I", "1")];
    expect(indentRow(drafts, 0)).toEqual(drafts);
  });

  it("outdent: bo'lim bob bo'ladi, undan keyingi bo'limlar unga o'tadi (tartib saqlanadi)", () => {
    const drafts = [
      draft("I", "1", [
        ["a", "2"],
        ["b", "3"],
        ["c", "4"],
      ]),
      draft("II", "5"),
    ];
    expect(titles(outdentRow(drafts, 0, 1))).toEqual([
      ["I", ["a"]],
      ["b", ["c"]],
      ["II", []],
    ]);
  });

  it("id va kalitlar saqlanadi (prezentatsiya yo'qolmasin)", () => {
    const drafts = [draft("I", "1"), { ...draft("b", "2"), id: "saved-b" }];
    const child = indentRow(drafts, 1)[0].children[0];
    expect(child).toMatchObject({ key: "k-b", id: "saved-b", title: "b", page: "2" });
    expect("children" in child).toBe(false);
    const back = outdentRow(indentRow(drafts, 1), 0, 0);
    expect(back[1]).toMatchObject({ key: "k-b", id: "saved-b", children: [] });
  });
});

describe("parseBulk: «I bob» sarlavhalari", () => {
  const titles = (rows: ChapterDraft[]) =>
    rows.map((d) => [d.title, d.children.map((c) => c.title)]);

  it("«I bob …» qatorlari bob (level 0), qolganlari shu bob ichidagi bo'lim", () => {
    const { rows } = parseBulk(
      [
        "Kirish ........ 3",
        "I bob. Algebraik ifodalar ........ 5",
        "1-§. Ko'phadlar ........ 6",
        "2-§. Kasrlar ........ 12",
        "II BOB Funksiyalar ........ 20",
        "3-§. Chiziqli funksiya ........ 21",
      ].join("\n"),
    );
    expect(titles(rows)).toEqual([
      ["Kirish", []],
      ["I bob. Algebraik ifodalar", ["1-§. Ko'phadlar", "2-§. Kasrlar"]],
      ["II BOB Funksiyalar", ["3-§. Chiziqli funksiya"]],
    ]);
  });

  it("raqamli va kirill yozuvdagi boblar ham taniladi", () => {
    const { rows } = parseBulk(
      "1-bob Sonlar 4\n1-§ Natural sonlar 5\nII боб Геометрия 30\n4-§ Нуқта 31",
    );
    expect(titles(rows)).toEqual([
      ["1-bob Sonlar", ["1-§ Natural sonlar"]],
      ["II боб Геометрия", ["4-§ Нуқта"]],
    ]);
  });

  it("«bob» so'zi sarlavha o'rtasida bo'lsa bob emas", () => {
    const { rows } = parseBulk("Kitob haqida bob 3\nMashqlar 4");
    expect(titles(rows)).toEqual([
      ["Kitob haqida bob", []],
      ["Mashqlar", []],
    ]);
  });
});
