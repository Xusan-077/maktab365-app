import { describe, expect, it } from "vitest";
import { isBlockedShortcut, isEditableTarget, watermarkLabel } from "./protection";

describe("isBlockedShortcut", () => {
  it("Ctrl/⌘+S va Ctrl/⌘+P ni bloklaydi, qolganini yo'q", () => {
    expect(isBlockedShortcut({ key: "s", ctrlKey: true, metaKey: false })).toBe(true);
    expect(isBlockedShortcut({ key: "P", ctrlKey: false, metaKey: true })).toBe(true);
    expect(isBlockedShortcut({ key: "f", ctrlKey: true, metaKey: false })).toBe(false);
    expect(isBlockedShortcut({ key: "s", ctrlKey: false, metaKey: false })).toBe(false);
  });
});

describe("watermarkLabel", () => {
  it("ism va emailni birlashtiradi, bo'sh bo'lsa bo'sh", () => {
    expect(watermarkLabel({ name: " Ali ", email: "a@x.uz" })).toBe("Ali · a@x.uz");
    expect(watermarkLabel({ name: null, email: "a@x.uz" })).toBe("a@x.uz");
    expect(watermarkLabel(null)).toBe("");
  });
});

describe("isEditableTarget", () => {
  it("null va oddiy element uchun false", () => {
    expect(isEditableTarget(null)).toBe(false);
  });
});
