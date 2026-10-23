import { describe, expect, it } from "vitest";
import { pushRecent, RECENT_MAX, sanitizeRecent, type RecentBook } from "./recent";

const book = (id: string): RecentBook => ({
  id,
  slug: `9-sinf-${id}`,
  title: { uz: id },
  grade: 9,
  subject: id,
  subject_title: { uz: id },
  subject_group: "exact",
  page_count: 10,
  size_bytes: 1,
  cover: null,
  unverified: false,
  published_at: null,
});

describe("pushRecent", () => {
  it("yangi kitob boshiga, takror bo'lsa ko'chiriladi", () => {
    const list = pushRecent(pushRecent(pushRecent([], book("a")), book("b")), book("a"));
    expect(list.map((b) => b.id)).toEqual(["a", "b"]);
  });
  it("uzunlik cheklanadi", () => {
    let list: RecentBook[] = [];
    for (let i = 0; i < RECENT_MAX + 5; i += 1) list = pushRecent(list, book(String(i)));
    expect(list).toHaveLength(RECENT_MAX);
    expect(list[0].id).toBe(String(RECENT_MAX + 4));
  });
  it("faqat kartaga kerakli maydonlar saqlanadi", () => {
    const [stored] = pushRecent([], { ...book("a"), chapters: [{ id: "x" }] } as RecentBook);
    expect("chapters" in stored).toBe(false);
  });
});

describe("sanitizeRecent", () => {
  it("buzilgan yozuvlarni tashlaydi", () => {
    expect(sanitizeRecent(null)).toEqual([]);
    expect(sanitizeRecent("x")).toEqual([]);
    expect(sanitizeRecent([book("a"), { id: 1 }, null, { id: "b" }])).toHaveLength(1);
  });
});
