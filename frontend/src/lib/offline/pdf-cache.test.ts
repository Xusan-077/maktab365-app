import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOffline,
  downloadWarnings,
  isSavedOffline,
  LARGE_DOWNLOAD_BYTES,
  loadOfflinePdf,
  offlineKey,
  OFFLINE_REGISTRY_KEY,
  readRegistry,
  removeOffline,
  sanitizeRegistry,
  savePdfOffline,
  totalOfflineBytes,
  upsertRegistry,
  type OfflineBook,
} from "./pdf-cache";

const book = (id: string, size = 100): OfflineBook => ({
  id,
  slug: `9-sinf-${id}`,
  grade: 9,
  title: { uz: id },
  sizeBytes: size,
  savedAt: "2026-10-23T00:00:00Z",
});

/** Minimal Cache Storage almashtiruvchisi (jsdom'da yo'q). */
function installFakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    const store = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, store);
    return {
      match: async (key: string) => store.get(key)?.clone(),
      put: async (key: string, response: Response) => void store.set(key, response),
      delete: async (key: string) => store.delete(key),
    };
  };
  vi.stubGlobal("caches", { open, delete: async (name: string) => stores.delete(name) });
}

function streamOf(bytes: Uint8Array, headers: Record<string, string> = {}) {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, 5));
        controller.enqueue(bytes.slice(5));
        controller.close();
      },
    }),
    { status: 200, headers },
  );
}

function installFakeStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  });
}

beforeEach(() => {
  installFakeStorage();
  installFakeCaches();
});
afterEach(() => vi.unstubAllGlobals());

describe("registry", () => {
  it("sanitize, upsert va yig'indi", () => {
    expect(sanitizeRegistry(null)).toEqual([]);
    expect(sanitizeRegistry([book("a"), { id: 1 }, null])).toEqual([book("a")]);
    const list = upsertRegistry(upsertRegistry([], book("a", 10)), book("b", 20));
    expect(list.map((b) => b.id)).toEqual(["b", "a"]);
    expect(upsertRegistry(list, book("a", 99))[0]).toMatchObject({ id: "a", sizeBytes: 99 });
    expect(totalOfflineBytes(list)).toBe(30);
  });
  it("buzilgan localStorage bo'sh ro'yxat beradi", () => {
    localStorage.setItem(OFFLINE_REGISTRY_KEY, "{not json");
    expect(readRegistry()).toEqual([]);
  });
});

describe("downloadWarnings", () => {
  it("katta fayl va xotira yetmasligi alohida ogohlantiriladi", () => {
    expect(downloadWarnings(1024, { usage: 0, quota: 1e9 })).toEqual([]);
    expect(downloadWarnings(LARGE_DOWNLOAD_BYTES, { usage: 0, quota: 1e12 })).toEqual(["large"]);
    expect(downloadWarnings(4e7, { usage: 9.5e8, quota: 1e9 })).toEqual(["space"]);
    expect(downloadWarnings(LARGE_DOWNLOAD_BYTES, { usage: 9e8, quota: 1e9 })).toEqual([
      "large",
      "space",
    ]);
    expect(downloadWarnings(1024, null)).toEqual([]);
  });
});

describe("savePdfOffline / loadOfflinePdf / removeOffline", () => {
  it("faylni oqim bilan yuklab saqlaydi, progress beradi va ro'yxatga yozadi", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 hello offline");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamOf(bytes, { "content-length": String(bytes.length) })),
    );
    const progress = vi.fn();
    const saved = await savePdfOffline({
      book: { id: "b1", slug: "9-sinf-algebra", grade: 9, title: { uz: "Algebra" } },
      url: "https://r2.test/b1.pdf",
      onProgress: progress,
    });
    expect(saved.sizeBytes).toBe(bytes.length);
    expect(progress).toHaveBeenLastCalledWith(1);
    expect(await isSavedOffline("b1")).toBe(true);
    expect(await loadOfflinePdf("b1")).toEqual(bytes);
    expect(readRegistry().map((b) => b.id)).toEqual(["b1"]);
    expect(offlineKey("b1")).toBe("/__offline__/pdf/b1");
  });

  it("yuklash xatosida hech narsa saqlanmaydi", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 403 })),
    );
    await expect(
      savePdfOffline({
        book: { id: "b2", slug: "x", grade: 1, title: { uz: "X" } },
        url: "https://r2.test/b2.pdf",
      }),
    ).rejects.toThrow();
    expect(await isSavedOffline("b2")).toBe(false);
    expect(readRegistry()).toEqual([]);
  });

  it("o'chirish va hammasini tozalash", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 abcdefgh");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamOf(bytes)),
    );
    for (const id of ["a", "b"]) {
      await savePdfOffline({
        book: { id, slug: id, grade: 1, title: { uz: id } },
        url: `https://r2.test/${id}.pdf`,
      });
    }
    await removeOffline("a");
    expect(await isSavedOffline("a")).toBe(false);
    expect(await isSavedOffline("b")).toBe(true);
    expect(readRegistry().map((b) => b.id)).toEqual(["b"]);

    await clearOffline();
    expect(await isSavedOffline("b")).toBe(false);
    expect(readRegistry()).toEqual([]);
  });
});
