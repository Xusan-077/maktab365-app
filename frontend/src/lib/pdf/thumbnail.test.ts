import { describe, expect, it } from "vitest";
import { COVER_WIDTH, coverScale, fitWidth } from "./thumbnail";

describe("thumbnail", () => {
  it("muqova eni ~600px", () => {
    expect(COVER_WIDTH).toBe(600);
    expect(coverScale(300)).toBe(2);
    expect(coverScale(0)).toBe(1);
  });
  it("katta rasm kichrayadi, kichigi o'zgarmaydi", () => {
    expect(fitWidth(2400)).toBe(600);
    expect(fitWidth(600)).toBe(600);
    expect(fitWidth(320)).toBe(320);
  });
});
