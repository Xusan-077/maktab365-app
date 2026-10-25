import { describe, expect, it, vi } from "vitest";
import { LruCache } from "./lru";

describe("LruCache", () => {
  it("sig'imdan oshganda eng uzoq ishlatilmagani chiqariladi (onEvict bilan)", () => {
    const evicted = vi.fn();
    const cache = new LruCache<string, number>(2, evicted);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // "a" yangilandi — "b" eng eski
    cache.set("c", 3);
    expect(cache.has("b")).toBe(false);
    expect(evicted).toHaveBeenCalledWith(2, "b");
    expect(cache.size).toBe(2);
  });

  it("almashtirilgan qiymat ham bo'shatiladi; clear — hammasi", () => {
    const evicted = vi.fn();
    const cache = new LruCache<string, number>(3, evicted);
    cache.set("a", 1);
    cache.set("a", 5);
    expect(evicted).toHaveBeenCalledWith(1, "a");
    cache.set("b", 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(evicted).toHaveBeenCalledTimes(3);
  });

  it("find — eng yangisidan, tartibni o'zgartirmaydi", () => {
    const cache = new LruCache<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.find((value) => value > 0)).toBe(2);
  });
});
