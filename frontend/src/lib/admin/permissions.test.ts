import { describe, expect, it } from "vitest";
import { canDelete, canSeeUsers, transitionsFor } from "./permissions";

describe("admin permissions", () => {
  it("editor: draft→reviewed→published, nashrdan qaytara olmaydi", () => {
    expect(transitionsFor("editor", "draft")).toEqual([{ to: "reviewed", action: "review" }]);
    expect(transitionsFor("editor", "reviewed")).toEqual([{ to: "published", action: "publish" }]);
    expect(transitionsFor("editor", "published")).toEqual([]);
  });

  it("admin: nashrdan qoralamaga qaytara oladi", () => {
    expect(transitionsFor("admin", "published")).toEqual([{ to: "draft", action: "unpublish" }]);
    expect(transitionsFor("admin", "draft")).toEqual([{ to: "reviewed", action: "review" }]);
  });

  it("o'chirish va foydalanuvchilar bo'limi faqat admin'ga", () => {
    expect(canDelete("admin")).toBe(true);
    expect(canDelete("editor")).toBe(false);
    expect(canSeeUsers("admin")).toBe(true);
    expect(canSeeUsers("editor")).toBe(false);
  });
});
