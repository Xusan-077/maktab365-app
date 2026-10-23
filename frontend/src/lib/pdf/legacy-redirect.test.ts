import { describe, expect, it } from "vitest";
import { legacyBookId, legacyBookTarget, legacyGradeRedirect } from "./legacy-redirect";

const UUID = "57f6e0ce-f3d8-463c-8ffc-7388484d0c8c";

describe("legacyBookId", () => {
  it("eski uuid manzilini taniydi", () => {
    expect(legacyBookId(`/darsliklar/${UUID}`)).toBe(UUID);
    expect(legacyBookId(`/darsliklar/${UUID}/`)).toBe(UUID);
  });
  it("sinf, slug va chuqur yo'llarni tanimaydi", () => {
    expect(legacyBookId("/darsliklar/9")).toBeNull();
    expect(legacyBookId("/darsliklar/algebra-9")).toBeNull();
    expect(legacyBookId(`/darsliklar/9/${UUID}`)).toBeNull();
    expect(legacyBookId("/darsliklar")).toBeNull();
  });
});

describe("legacyGradeRedirect", () => {
  it("?grade=9 ni /darsliklar/9 ga o'tkazadi, qolganini saqlaydi", () => {
    expect(legacyGradeRedirect("/darsliklar", "?grade=9")).toBe("/darsliklar/9");
    expect(legacyGradeRedirect("/darsliklar", "?grade=9&q=algebra&page=2")).toBe(
      "/darsliklar/9?q=algebra",
    );
  });
  it("yaroqsiz sinf yoki boshqa yo'lda o'tkazmaydi", () => {
    expect(legacyGradeRedirect("/darsliklar", "?grade=12")).toBeNull();
    expect(legacyGradeRedirect("/darsliklar", "?grade=abc")).toBeNull();
    expect(legacyGradeRedirect("/darsliklar", "")).toBeNull();
    expect(legacyGradeRedirect("/darsliklar/9", "?grade=9")).toBeNull();
  });
});

describe("legacyBookTarget", () => {
  const book = { grade: 9, slug: "9-sinf-algebra" };
  it("o'qish oynasiga o'tkazadi va ?page= ni saqlaydi", () => {
    expect(legacyBookTarget(book, "")).toBe("/darsliklar/9/9-sinf-algebra/oqish");
    expect(legacyBookTarget(book, "?page=12")).toBe("/darsliklar/9/9-sinf-algebra/oqish?page=12");
  });
  it("boshqa parametrlarni (slides) saqlaydi", () => {
    expect(legacyBookTarget(book, "?page=3&slides=c1&slide=2")).toBe(
      "/darsliklar/9/9-sinf-algebra/oqish?page=3&slides=c1&slide=2",
    );
    expect(legacyBookTarget(book, "?slides=c1")).toBe(
      "/darsliklar/9/9-sinf-algebra/oqish?slides=c1",
    );
  });
});
