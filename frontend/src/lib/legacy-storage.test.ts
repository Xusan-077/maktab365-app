import { describe, expect, it } from "vitest";
import { clearLegacyStorage } from "./legacy-storage";

function memoryStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("clearLegacyStorage", () => {
  it("eski mavzu kalitlarini o'chiradi, PDF va sozlamalarga tegmaydi", () => {
    const storage = memoryStorage({
      "maktab365-guest": "{}",
      "maktab365-reading": "{}",
      "maktab365-sync:user-1": "[]",
      "maktab365-sync:user-2": "[]",
      "maktab365-guest-pdf": "{}",
      "maktab365-prefs": "{}",
    });

    expect(clearLegacyStorage(storage)).toBe(4);
    expect([...storage.data.keys()].sort()).toEqual(["maktab365-guest-pdf", "maktab365-prefs"]);
  });

  it("xotira bo'lmasa yoki xato bersa jim o'tadi", () => {
    expect(clearLegacyStorage(undefined)).toBe(0);
    const broken = {
      length: 1,
      key: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    };
    expect(clearLegacyStorage(broken)).toBe(0);
  });
});
