import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/types";
import { countKeyLines, keyErrorCode, keyErrors, keyToText } from "./answer-key";

describe("javoblar kaliti: matn", () => {
  it("qatorlarni `bet, savol, javob` ko'rinishiga keltiradi", () => {
    expect(
      keyToText([
        { page: 1, question: 1, answer: "A" },
        { page: 2, question: 3, answer: "12,5" },
      ]),
    ).toBe("1, 1, A\n2, 3, 12,5");
  });

  it("bo'sh va izoh qatorlarini sanamaydi", () => {
    expect(countKeyLines("bet,savol,javob\n\n# izoh\n1,1,A\r\n  \n1,2,B")).toBe(3);
  });
});

describe("javoblar kaliti: server xatolari", () => {
  const error = (details: Record<string, string[]>) =>
    new ApiError("x", 400, { code: "validation_error", details });

  it("qator xatolarini ajratadi", () => {
    expect(keyErrors(error({ text: ["2: page_out_of_range", "5: duplicate"] }))).toEqual([
      { line: 2, code: "page_out_of_range" },
      { line: 5, code: "duplicate" },
    ]);
  });

  it("qatorsiz kodni alohida qaytaradi", () => {
    expect(keyErrorCode(error({ text: ["empty"] }))).toBe("empty");
    expect(keyErrorCode(error({ detail: ["not_test_book"] }))).toBe("not_test_book");
    expect(keyErrorCode(error({ text: ["3: duplicate"] }))).toBeNull();
  });

  it("boshqa xatolarda bo'sh", () => {
    expect(keyErrors(new Error("tarmoq"))).toEqual([]);
    expect(keyErrorCode(null)).toBeNull();
  });
});
