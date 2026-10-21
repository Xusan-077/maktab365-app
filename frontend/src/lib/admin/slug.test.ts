import { describe, expect, it } from "vitest";
import { SLUG_PATTERN } from "@/lib/validation/admin";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lotin sarlavhani slug'ga aylantiradi", () => {
    expect(slugify("Viyet teoremasi")).toBe("viyet-teoremasi");
    expect(slugify("  Kvadrat   tenglama!  ")).toBe("kvadrat-tenglama");
  });

  it("o'zbek apostroflari va diakritiklarni olib tashlaydi", () => {
    expect(slugify("O'quvchi g‘oyasi")).toBe("oquvchi-goyasi");
    expect(slugify("Été")).toBe("ete");
  });

  it("kirill va bo'sh matn bo'sh slug beradi; natija doim yaroqli yoki bo'sh", () => {
    expect(slugify("Привет")).toBe("");
    expect(slugify("")).toBe("");
    const long = slugify("a ".repeat(60));
    expect(long.length).toBeLessThanOrEqual(50);
    expect(SLUG_PATTERN.test(long)).toBe(true);
  });
});
