import { describe, expect, it } from "vitest";
import { isReturnLanding, RETURN_TO_TTL_MS, saveReturnTo, takeReturnTo } from "./return-to";

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe("return-to", () => {
  it("saqlaydi va bir marta qaytaradi", () => {
    const store = memory();
    expect(saveReturnTo("/uz/kitoblar/yozuvlarim?tur=note", 1000, store)).toBe(true);
    expect(takeReturnTo(2000, store)).toBe("/uz/kitoblar/yozuvlarim?tur=note");
    expect(takeReturnTo(2000, store)).toBeNull();
  });

  it("muddati o'tgan yozuv qaytarilmaydi", () => {
    const store = memory();
    saveReturnTo("/uz/kitoblar", 1000, store);
    expect(takeReturnTo(1000 + RETURN_TO_TTL_MS + 1, store)).toBeNull();
  });

  it("tashqi yoki yaroqsiz yo'l saqlanmaydi", () => {
    const store = memory();
    expect(saveReturnTo("//evil.example", 1, store)).toBe(false);
    expect(saveReturnTo("https://evil.example", 1, store)).toBe(false);
    expect(saveReturnTo("/uz\\evil", 1, store)).toBe(false);
    expect(takeReturnTo(2, store)).toBeNull();
  });

  it("kirish va onboarding sahifalari saqlanmaydi", () => {
    const store = memory();
    for (const path of ["/uz/kirish", "/uz/kirish?x=1", "/ru/onboarding", "/uz/kod"]) {
      expect(saveReturnTo(path, 1, store)).toBe(false);
    }
  });

  it("buzilgan qiymat va xotira yo'qligi jim o'tadi", () => {
    const store = memory();
    store.setItem("maktab365-return-to", "{oops");
    expect(takeReturnTo(1, store)).toBeNull();
    expect(saveReturnTo("/uz/kitoblar", 1, null)).toBe(false);
    expect(takeReturnTo(1, null)).toBeNull();
  });

  it("faqat panel bosh sahifasi qaytish nuqtasi", () => {
    expect(isReturnLanding("/uz/kabinet")).toBe(true);
    expect(isReturnLanding("/ru/ustoz")).toBe(true);
    expect(isReturnLanding("/uz/kabinet/natijalar")).toBe(false);
    expect(isReturnLanding("/uz/kitoblar")).toBe(false);
  });
});
