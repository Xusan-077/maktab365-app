import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_URL, resolveSiteUrl } from "./seo";

describe("resolveSiteUrl", () => {
  it("env berilmasa yoki bo'sh bo'lsa prod domeni", () => {
    expect(DEFAULT_SITE_URL).toBe("https://www.darslik365.uz");
    expect(resolveSiteUrl(undefined)).toBe("https://www.darslik365.uz");
    expect(resolveSiteUrl("")).toBe("https://www.darslik365.uz");
    expect(resolveSiteUrl("   ")).toBe("https://www.darslik365.uz");
  });

  it("env qiymati oxirgi `/` siz ishlatiladi", () => {
    expect(resolveSiteUrl("https://www.darslik365.uz/")).toBe("https://www.darslik365.uz");
    expect(resolveSiteUrl(" https://preview.example.com ")).toBe("https://preview.example.com");
  });
});
