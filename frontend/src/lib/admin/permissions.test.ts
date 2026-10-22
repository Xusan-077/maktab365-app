import { describe, expect, it } from "vitest";
import { canDelete, canSeeUsers } from "./permissions";

describe("admin permissions", () => {
  it("o'chirish va foydalanuvchilar bo'limi faqat admin'ga", () => {
    expect(canDelete("admin")).toBe(true);
    expect(canDelete("editor")).toBe(false);
    expect(canSeeUsers("admin")).toBe(true);
    expect(canSeeUsers("editor")).toBe(false);
  });
});
