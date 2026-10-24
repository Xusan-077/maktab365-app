import { describe, expect, it } from "vitest";
import {
  appBaseOfPath,
  baseHome,
  catalogPath,
  dashboardPath,
  helpPath,
  gradePath,
  pdfBookPath,
  readerPath,
  roleBase,
  safeCallbackPath,
} from "./routes";

describe("appBaseOfPath", () => {
  it("panelni yo'ldan aniqlaydi", () => {
    expect(appBaseOfPath("/kabinet")).toBe("kabinet");
    expect(appBaseOfPath("/kabinet/saqlanganlar")).toBe("kabinet");
    expect(appBaseOfPath("/ustoz/yordam")).toBe("ustoz");
  });

  it("marketing, sozlamalar va o'xshash prefikslarda null", () => {
    expect(appBaseOfPath("/")).toBeNull();
    expect(appBaseOfPath("/darsliklar")).toBeNull();
    expect(appBaseOfPath("/sozlamalar")).toBeNull();
    expect(appBaseOfPath("/kabinetim")).toBeNull();
    expect(appBaseOfPath("/ustozlar")).toBeNull();
  });
});

describe("yo'llar", () => {
  it("katalog va kitob sahifasi hamma uchun bir xil, ochiq yo'lda", () => {
    expect(catalogPath()).toBe("/darsliklar");
    expect(pdfBookPath({ grade: 9, slug: "9-sinf-algebra" })).toBe("/darsliklar/9/9-sinf-algebra");
    expect(gradePath(9)).toBe("/darsliklar?sinf=9");
    expect(readerPath({ grade: 9, slug: "x" })).toBe("/darsliklar/9/x/oqish");
    expect(readerPath({ grade: 9, slug: "x" }, 1)).toBe("/darsliklar/9/x/oqish");
    expect(readerPath({ grade: 9, slug: "x" }, 12)).toBe("/darsliklar/9/x/oqish?page=12");
  });

  it("baza bosh sahifasi, rolga mos baza va yordam sahifasi", () => {
    expect(baseHome("marketing")).toBe("/");
    expect(baseHome("kabinet")).toBe("/kabinet");
    expect(baseHome("ustoz")).toBe("/ustoz");
    expect(roleBase("student")).toBe("kabinet");
    expect(roleBase("teacher")).toBe("ustoz");
    expect(helpPath("kabinet")).toBe("/kabinet/yordam");
    expect(helpPath("ustoz")).toBe("/ustoz/yordam");
    expect(dashboardPath("teacher")).toBe("/ustoz");
  });
});

describe("safeCallbackPath", () => {
  it("faqat ichki yo'llarni qabul qiladi", () => {
    expect(safeCallbackPath("/uz/darsliklar")).toBe("/uz/darsliklar");
    expect(safeCallbackPath("//evil.example")).toBeUndefined();
    expect(safeCallbackPath("https://evil.example")).toBeUndefined();
    expect(safeCallbackPath("/a\\b")).toBeUndefined();
    expect(safeCallbackPath(null)).toBeUndefined();
  });
});
