import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pdf-books/server", () => ({
  getAllBooks: async () => [
    { slug: "9-sinf-algebra", grade: 9, unverified: false, published_at: "2026-10-01T00:00:00Z" },
    { slug: "yashirin", grade: 9, unverified: true, published_at: null },
  ],
}));
vi.mock("@/lib/books/server", () => ({
  getAllLibraryBooks: async () => [{ slug: "otkan-kunlar", created_at: "2026-09-01T00:00:00Z" }],
}));

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("barcha sahifa 4 tilda, har yozuvda alternates; yashirin kitob yo'q", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith("/uz/darsliklar/9/9-sinf-algebra"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/ru/kutubxona/otkan-kunlar"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/uz-Cyrl/kutubxona"))).toBe(true);
    expect(urls.some((url) => url.includes("yashirin"))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
    const lib = entries.find((entry) => entry.url.endsWith("/uz/kutubxona/otkan-kunlar"));
    expect(lib?.lastModified).toBe("2026-09-01T00:00:00Z");
    expect(Object.keys(lib?.alternates?.languages ?? {}).sort()).toEqual(
      ["en", "ru", "uz", "uz-Cyrl"].sort(),
    );
  });

  it("shaxsiy sahifalar sitemap'da yo'q", async () => {
    const urls = (await sitemap()).map((entry) => entry.url).join("\n");
    for (const path of ["/admin", "/kabinet", "/kirish", "/oqish", "/yozuvlarim"]) {
      expect(urls).not.toContain(path);
    }
  });
});
