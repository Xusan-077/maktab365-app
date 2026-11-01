import { describe, expect, it } from "vitest";
import { loadBookZoom, saveBookZoom, ZOOM_MEMORY_KEY, ZOOM_MEMORY_LIMIT } from "./zoom-memory";
import { commitZoom } from "./zoom";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

describe("zoom-memory", () => {
  it("har kitob o'z zoom'ini eslab qoladi", () => {
    const storage = memoryStorage();
    saveBookZoom("a", 2.345, storage);
    saveBookZoom("b", 0.7, storage);
    expect(loadBookZoom("a", storage)).toBe(2.35);
    expect(loadBookZoom("b", storage)).toBe(0.7);
    expect(loadBookZoom("c", storage)).toBeNull();
  });

  it("chegaradan chiqqan va buzilgan qiymatlar xavfsiz", () => {
    const storage = memoryStorage();
    storage.setItem(ZOOM_MEMORY_KEY, JSON.stringify({ a: 99, b: "x", c: null }));
    expect(loadBookZoom("a", storage)).toBe(4);
    expect(loadBookZoom("b", storage)).toBeNull();
    storage.setItem(ZOOM_MEMORY_KEY, "{buzuq");
    expect(loadBookZoom("a", storage)).toBeNull();
    expect(loadBookZoom("a", null)).toBeNull();
  });

  it("eng eski kitoblar tashlanadi", () => {
    const storage = memoryStorage();
    for (let i = 0; i <= ZOOM_MEMORY_LIMIT; i += 1) saveBookZoom(`k${i}`, 1.5, storage);
    expect(loadBookZoom("k0", storage)).toBeNull();
    expect(loadBookZoom(`k${ZOOM_MEMORY_LIMIT}`, storage)).toBe(1.5);
  });
});

describe("commitZoom", () => {
  it("0.01 ga yaxlitlaydi (0.05 qadam emas) va 50%–400% ichida", () => {
    expect(commitZoom(1.234)).toBe(1.23);
    expect(commitZoom(1.03)).toBe(1.03);
    expect(commitZoom(9)).toBe(4);
    expect(commitZoom(0.1)).toBe(0.5);
  });
});
