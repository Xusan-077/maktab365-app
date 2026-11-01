import { describe, expect, it } from "vitest";
import { flattenChapters } from "./source";

describe("flattenChapters", () => {
  it("bob va uning bo'limlarini hujjat tartibida tekis ro'yxatga aylantiradi", () => {
    const result = flattenChapters([
      { id: "a", title: "I bob", page: 3, children: [{ id: "a1", title: "1-§", page: 4 }] },
      { id: "b", title: "II bob", page: 20 },
    ]);
    expect(result).toEqual([
      { id: "a", title: "I bob", start_page: 3 },
      { id: "a1", title: "1-§", start_page: 4 },
      { id: "b", title: "II bob", start_page: 20 },
    ]);
  });

  it("mundarijasiz kitob uchun bo'sh ro'yxat beradi", () => {
    expect(flattenChapters([])).toEqual([]);
  });
});
