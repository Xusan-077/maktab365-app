import { describe, expect, it } from "vitest";
import { pdfFileProblem } from "./pdf-file";

const file = (name: string, size: number, type = "application/pdf") => ({ name, size, type });

describe("pdfFileProblem", () => {
  it("to'g'ri PDF'ni qabul qiladi", () => {
    expect(pdfFileProblem(file("Algebra.PDF", 10))).toBeNull();
  });

  it("kengaytma yoki MIME noto'g'ri bo'lsa rad etadi", () => {
    expect(pdfFileProblem(file("a.exe", 10))).toBe("notPdf");
    expect(pdfFileProblem(file("a.pdf", 10, "image/png"))).toBe("notPdf");
    expect(pdfFileProblem(file("a.pdf", 10, ""))).toBe("notPdf");
  });

  it("bo'sh va juda katta faylni rad etadi", () => {
    expect(pdfFileProblem(file("a.pdf", 0))).toBe("empty");
    expect(pdfFileProblem(file("a.pdf", 101), 100)).toBe("tooLarge");
    expect(pdfFileProblem(file("a.pdf", 100), 100)).toBeNull();
  });
});
