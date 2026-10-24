import { describe, expect, it } from "vitest";
import { SUBJECT_GROUPS } from "@/lib/pdf/grade-groups";
import { groupColor, toSubjectGroup } from "./subject-colors";

describe("subject-colors", () => {
  it("har bir backend guruhi uchun rang bor va tokenlarga bog'langan", () => {
    for (const group of SUBJECT_GROUPS) {
      const color = groupColor(group);
      expect(color.text).toBe(`text-group-${group}`);
      expect(color.soft).toBe(`bg-group-${group}-soft`);
      expect(color.vars.color).toBe(`var(--group-${group})`);
    }
  });

  it("URL slug'i (aniq, tabiiy…) ham ishlaydi", () => {
    expect(toSubjectGroup("aniq")).toBe("exact");
    expect(toSubjectGroup("tillar")).toBe("language");
    expect(toSubjectGroup("sanat")).toBe("arts");
  });

  it("noma'lum yoki bo'sh qiymat brend rangiga tushadi", () => {
    expect(toSubjectGroup("xyz")).toBeUndefined();
    expect(groupColor(undefined)).toBe(groupColor("exact"));
    expect(groupColor("xyz")).toBe(groupColor("exact"));
  });
});
