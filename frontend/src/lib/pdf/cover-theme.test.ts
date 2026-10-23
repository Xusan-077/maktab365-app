import { describe, expect, it } from "vitest";
import { coverTone, FALLBACK_TONES, hashString, SUBJECT_GROUPS } from "./cover-theme";

describe("coverTone", () => {
  it("ma'lum fanlarni guruhga bog'laydi", () => {
    expect(coverTone("matematika")).toBe("exact");
    expect(coverTone("algebra")).toBe("exact");
    expect(coverTone("biologiya")).toBe("nature");
    expect(coverTone("tarix")).toBe("social");
    expect(coverTone("adabiyot")).toBe("language");
  });

  it("katta-kichik harf va bo'sh joyga befarq", () => {
    expect(coverTone("  Fizika ")).toBe("exact");
  });

  it("noma'lum fan uchun barqaror zaxira ohang beradi", () => {
    const tone = coverTone("astronomiya");
    expect(tone).toMatch(/^fallback-\d$/);
    expect(coverTone("astronomiya")).toBe(tone);
    const index = Number(tone.split("-")[1]);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(FALLBACK_TONES);
  });

  it("zaxira ohanglar har xil nomlarda tarqaladi", () => {
    const tones = new Set(
      [
        "astronomiya",
        "falsafa",
        "iqtisod",
        "huquq",
        "etika",
        "psixologiya",
        "mantiq",
        "ekologiya",
      ].map(coverTone),
    );
    expect(tones.size).toBeGreaterThan(2);
  });

  it("xesh deterministik", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).not.toBe(hashString("abd"));
  });

  it("xaritadagi barcha fanlar to'rt guruhdan biriga tegishli", () => {
    expect(new Set(Object.values(SUBJECT_GROUPS))).toEqual(
      new Set(["exact", "nature", "social", "language"]),
    );
  });
});
