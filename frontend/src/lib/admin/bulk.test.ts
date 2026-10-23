import { describe, expect, it } from "vitest";
import {
  dedupeFiles,
  guessGrade,
  guessSubject,
  makeRow,
  rowProblem,
  titleFromFilename,
  type BulkSubject,
} from "./bulk";

const SUBJECTS: BulkSubject[] = [
  { slug: "algebra", title: { uz: "Algebra", ru: "Алгебра", en: "Algebra" } },
  { slug: "geometriya", title: { uz: "Geometriya", ru: "Геометрия" } },
  { slug: "ona-tili", title: { uz: "Ona tili", ru: "Родной язык" } },
  { slug: "tarix", title: { uz: "Tarix", ru: "История" } },
  { slug: "tasviriy-san-at", title: { uz: "Tasviriy san'at" } },
];

const pdf = (name: string, size = 1000) =>
  new File([new Uint8Array(size)], name, { type: "application/pdf" });

describe("guessGrade", () => {
  it.each([
    ["9-sinf-algebra.pdf", 9],
    ["Algebra 9 sinf.pdf", 9],
    ["Algebra_9-sinf.pdf", 9],
    ["10 класс история.pdf", 10],
    ["grade_11_algebra.pdf", 11],
    ["sinf 5 matematika.pdf", 5],
    ["7_geometriya.pdf", 7],
    ["11-algebra.pdf", 11],
  ])("%s → %i", (name, grade) => expect(guessGrade(name)).toBe(grade));

  it.each(["algebra.pdf", "12-sinf-algebra.pdf", "0-sinf.pdf", "2024 algebra.pdf", "x9y.pdf"])(
    "%s → null",
    (name) => expect(guessGrade(name)).toBeNull(),
  );

  it("aniq 'sinf' so'zi nom boshidagi raqamdan ustun", () => {
    expect(guessGrade("2 jild algebra 8 sinf.pdf")).toBe(8);
  });
});

describe("guessSubject", () => {
  it("slug, uz va ru nomlari bo'yicha (katta-kichik harfsiz)", () => {
    expect(guessSubject("9-sinf-algebra.pdf", SUBJECTS)).toBe("algebra");
    expect(guessSubject("Геометрия 8 класс.pdf", SUBJECTS)).toBe("geometriya");
    expect(guessSubject("5-sinf Ona tili.pdf", SUBJECTS)).toBe("ona-tili");
    expect(guessSubject("ona_tili_5.pdf", SUBJECTS)).toBe("ona-tili");
    expect(guessSubject("Tasviriy san’at 6.pdf", SUBJECTS)).toBe("tasviriy-san-at");
  });
  it("topilmasa yoki so'z bo'lagi bo'lsa null", () => {
    expect(guessSubject("kitob.pdf", SUBJECTS)).toBeNull();
    expect(guessSubject("algebraik.pdf", SUBJECTS)).toBeNull();
  });
});

describe("titleFromFilename", () => {
  it("kengaytma, sinf belgisi va tagchiziqlarsiz, bosh harf katta", () => {
    expect(titleFromFilename("9-sinf-algebra.pdf")).toBe("Algebra");
    expect(titleFromFilename("ona_tili_5_sinf.pdf")).toBe("Ona tili");
    expect(titleFromFilename("Matematika - 3-sinf.PDF")).toBe("Matematika");
  });
  it("faqat sinf bo'lsa bo'sh", () => {
    expect(titleFromFilename("9-sinf.pdf")).toBe("");
  });
});

describe("rowProblem", () => {
  it("tayyor qator — muammo yo'q", () => {
    const row = makeRow(pdf("9-sinf-algebra.pdf"), SUBJECTS);
    expect(row).toMatchObject({ title: "Algebra", grade: 9, subject: "algebra" });
    expect(rowProblem(row)).toBeNull();
  });
  it("tartib: fayl → nom → sinf → fan", () => {
    const ok = makeRow(pdf("9-sinf-algebra.pdf"), SUBJECTS);
    expect(rowProblem({ ...ok, file: new File(["x"], "a.txt", { type: "text/plain" }) })).toBe(
      "notPdf",
    );
    expect(rowProblem({ ...ok, title: "  " })).toBe("title");
    expect(rowProblem({ ...ok, grade: null })).toBe("grade");
    expect(rowProblem({ ...ok, subject: null })).toBe("subject");
  });
});

describe("dedupeFiles", () => {
  it("ro'yxatdagi va bir yuklashdagi takrorlarni tashlaydi", () => {
    const existing = [makeRow(pdf("a.pdf", 10), SUBJECTS)];
    const kept = dedupeFiles(existing, [pdf("a.pdf", 10), pdf("b.pdf", 5), pdf("b.pdf", 5)]);
    expect(kept.map((f) => f.name)).toEqual(["b.pdf"]);
  });
});

describe("guessSubject with grades", () => {
  it("skips subjects not taught in the guessed grade", () => {
    const subjects = [
      { slug: "fizika", title: { uz: "Fizika" }, grades: [7, 8, 9, 10, 11] },
      { slug: "algebra", title: { uz: "Algebra" }, grades: [7, 8, 9, 10, 11] },
    ];
    expect(guessSubject("fizika.pdf", subjects, 5)).toBeNull();
    expect(guessSubject("fizika.pdf", subjects, 8)).toBe("fizika");
  });
});
