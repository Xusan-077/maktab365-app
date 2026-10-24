import { describe, expect, it } from "vitest";
import type { PdfSubject } from "@/lib/pdf-books/api";
import { availableTabs, buildSections } from "./subject-groups";

const subject = (
  slug: string,
  uz: string,
  group: string,
  order: number,
  ru?: string,
): PdfSubject => ({
  slug,
  title: { uz, ru },
  icon: "",
  order,
  group,
  grades: [1],
  books_count: 1,
});

const SUBJECTS = [
  subject("fizika", "Fizika", "natural", 9, "Физика"),
  subject("algebra", "Algebra", "exact", 2),
  subject("matematika", "Matematika", "exact", 1),
  subject("ona-tili", "Ona tili", "language", 5),
  subject("yangi", "Yangi fan", "", 99),
];

describe("buildSections", () => {
  it("guruh tartibida, ichida order bo'yicha; guruhsiz fan oxirida", () => {
    const sections = buildSections(SUBJECTS, "", "all");
    expect(sections.map((s) => s.key)).toEqual(["exact", "natural", "language", "other"]);
    expect(sections[0].subjects.map((s) => s.slug)).toEqual(["matematika", "algebra"]);
  });

  it("tab bo'yicha bitta bo'lim", () => {
    expect(buildSections(SUBJECTS, "", "natural").map((s) => s.key)).toEqual(["natural"]);
  });

  it("qidiruv: katta-kichik harf, kirill va boshqa til nomi", () => {
    expect(
      buildSections(SUBJECTS, "ALGE", "all").flatMap((s) => s.subjects.map((x) => x.slug)),
    ).toEqual(["algebra"]);
    expect(
      buildSections(SUBJECTS, "физика", "all").flatMap((s) => s.subjects.map((x) => x.slug)),
    ).toEqual(["fizika"]);
    expect(buildSections(SUBJECTS, "yo'q fan", "all")).toEqual([]);
  });
});

describe("availableTabs", () => {
  it("faqat fani bor bo'limlar", () => {
    expect(availableTabs(SUBJECTS)).toEqual(["all", "exact", "natural", "language", "other"]);
    expect(availableTabs([SUBJECTS[0]])).toEqual(["all", "natural"]);
  });
});
