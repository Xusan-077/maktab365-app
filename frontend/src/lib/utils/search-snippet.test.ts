import { describe, expect, it } from "vitest";
import { splitSnippet } from "./search-snippet";

describe("splitSnippet", () => {
  it("mos so'zlarni ajratadi", () => {
    expect(splitSnippet("… ⟦Diskriminant⟧ni hisoblab, ⟦diskrim⟧ …")).toEqual([
      { text: "… ", match: false },
      { text: "Diskriminant", match: true },
      { text: "ni hisoblab, ", match: false },
      { text: "diskrim", match: true },
      { text: " …", match: false },
    ]);
  });

  it("belgisiz matn bitta bo'lak", () => {
    expect(splitSnippet("oddiy matn")).toEqual([{ text: "oddiy matn", match: false }]);
    expect(splitSnippet("")).toEqual([]);
  });

  it("yopilmagan belgi matn ichida qoladi (belgisiz)", () => {
    expect(splitSnippet("a ⟦b")).toEqual([{ text: "a b", match: false }]);
  });

  it("HTML teglar oddiy matn bo'lib qoladi", () => {
    expect(splitSnippet("<b>x</b> ⟦a < b⟧")).toEqual([
      { text: "<b>x</b> ", match: false },
      { text: "a < b", match: true },
    ]);
  });
});
