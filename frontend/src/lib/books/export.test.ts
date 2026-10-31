import { describe, expect, it } from "vitest";
import { wrapLines } from "./annotation-render";
import { bookNotesMarkdown, exportSize, fileSlug, pageFileName, pageNoteMarkdown } from "./export";

describe("fileSlug / pageFileName", () => {
  it("harf va raqamlar qoladi, qolgani '-' bo'ladi", () => {
    expect(fileSlug("Sariq devni minib!")).toBe("sariq-devni-minib");
    expect(fileSlug("  ///  ")).toBe("kitob");
    expect(fileSlug("Алгебра 9-синф")).toBe("алгебра-9-синф");
  });

  it("uzun nom qisqartiriladi va '-' bilan tugamaydi", () => {
    const slug = fileSlug("a".repeat(39) + " b".repeat(20));
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("fayl nomi bet raqamini o'z ichiga oladi", () => {
    expect(pageFileName("Matematika 5", 12, "png")).toBe("matematika-5-bet-12.png");
    expect(pageFileName("", 3, "md")).toBe("kitob-bet-3.md");
  });
});

describe("exportSize", () => {
  it("chegaradan katta rasm nisbat bilan kichraytiriladi", () => {
    expect(exportSize(4000, 5600, 2000)).toEqual({ width: 2000, height: 2800 });
  });

  it("kichik rasm o'zgarmaydi", () => {
    expect(exportSize(1400, 1960, 2000)).toEqual({ width: 1400, height: 1960 });
  });
});

describe("markdown", () => {
  it("bitta bet", () => {
    expect(pageNoteMarkdown("Algebra", { page: 7, text: " Muhim formula \n" }, "7-bet")).toBe(
      "# Algebra\n\n## 7-bet\n\nMuhim formula\n",
    );
  });

  it("kitob: bet tartibida, bo'sh betlar tashlanadi, matn annotatsiyalari ro'yxat bo'ladi", () => {
    const entries = [
      {
        page: 9,
        note: "",
        annotations: [{ id: "x", type: "highlight" as const, data: {}, updated_at: "" }],
      },
      {
        page: 5,
        note: "Ikkinchi",
        annotations: [
          { id: "t", type: "text" as const, data: { text: "Imtihonda" }, updated_at: "" },
        ],
      },
      { page: 2, note: "Birinchi", annotations: [] },
    ];
    const markdown = bookNotesMarkdown("Fizika", entries, {
      page: (page) => `${page}-bet`,
      texts: "Matnlar",
    });
    expect(markdown.indexOf("2-bet")).toBeLessThan(markdown.indexOf("5-bet"));
    expect(markdown).not.toContain("9-bet");
    expect(markdown).toContain("- Imtihonda");
    expect(markdown).toContain("**Matnlar**");
  });
});

describe("wrapLines", () => {
  const measure = (text: string) => text.length * 10;

  it("so'zlar kenglikka sig'maganda keyingi qatorga o'tadi", () => {
    expect(wrapLines(measure, "bir ikki uch to'rt", 90)).toEqual(["bir ikki", "uch to'rt"]);
  });

  it("yangi qator saqlanadi, juda uzun so'z bo'linmaydi", () => {
    expect(wrapLines(measure, "a\nb", 100)).toEqual(["a", "b"]);
    expect(wrapLines(measure, "uzunuzunuzunuzun x", 50)).toEqual(["uzunuzunuzunuzun", "x"]);
  });
});
