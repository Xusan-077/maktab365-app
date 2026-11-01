import { describe, expect, it } from "vitest";
import { parseBookRef } from "./ref";

describe("parseBookRef", () => {
  it("UUID va slug'ni ajratadi", () => {
    expect(parseBookRef("11111111-1111-4111-8111-111111111111")?.kind).toBe("id");
    expect(parseBookRef("otkan-kunlar")).toEqual({ kind: "slug", value: "otkan-kunlar" });
  });
  it("yaroqsiz qiymatni rad etadi", () => {
    for (const bad of ["", "Katta", "a_b", "../x", "a b", "-x", "x".repeat(121)]) {
      expect(parseBookRef(bad)).toBeNull();
    }
  });
});

describe("SAMPLE_REF", () => {
  it("slug ham, uuid ham emas (backend'ga so'rov ketmaydi)", async () => {
    const { SAMPLE_REF, parseBookRef } = await import("./ref");
    expect(parseBookRef(SAMPLE_REF)).toBeNull();
  });
});
