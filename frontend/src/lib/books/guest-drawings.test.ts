import { describe, expect, it } from "vitest";
import type { AnnotationItem } from "./annotations";
import {
  GUEST_DRAWINGS_PREFIX,
  GuestDrawings,
  type GuestDrawingsBackend,
  type GuestPages,
} from "./guest-drawings";

function memoryBackend() {
  const data = new Map<string, GuestPages>();
  const backend: GuestDrawingsBackend = {
    get: async (key) => data.get(key),
    set: async (key, value) => void data.set(key, structuredClone(value)),
    remove: async (key) => void data.delete(key),
  };
  return { data, backend };
}

const item = (id: string): AnnotationItem => ({ id, type: "drawing", data: {} });

describe("GuestDrawings", () => {
  it("betlarni kitob bo'yicha saqlaydi va o'qiydi", async () => {
    const { data, backend } = memoryBackend();
    const store = new GuestDrawings("kitob", backend);
    await store.savePage(2, [item("a")]);
    await store.savePage(5, [item("b"), item("c")]);
    expect(await store.load()).toEqual({ 2: [item("a")], 5: [item("b"), item("c")] });
    expect(data.has(`${GUEST_DRAWINGS_PREFIX}kitob`)).toBe(true);
    expect(await new GuestDrawings("boshqa", backend).load()).toEqual({});
  });

  it("ketma-ket tez yozuvlarda oxirgi holat qoladi; bo'sh bet o'chadi", async () => {
    const { data, backend } = memoryBackend();
    const store = new GuestDrawings("k", backend);
    void store.savePage(1, [item("a")]);
    void store.savePage(1, [item("a"), item("b")]);
    await store.savePage(3, [item("c")]);
    expect((await store.load())[1]).toHaveLength(2);
    await store.savePage(1, []);
    await store.savePage(3, []);
    expect(data.size).toBe(0);
  });

  it("clear kitobning hamma chizmalarini o'chiradi, boshqa kitobga tegmaydi", async () => {
    const { data, backend } = memoryBackend();
    const store = new GuestDrawings("k", backend);
    await store.savePage(1, [item("a")]);
    await store.savePage(4, [item("b")]);
    await new GuestDrawings("boshqa", backend).savePage(1, [item("c")]);
    await store.clear();
    expect(await store.load()).toEqual({});
    expect(data.size).toBe(1);
  });

  it("buzuq yozuvni e'tiborsiz qoldiradi", async () => {
    const { data, backend } = memoryBackend();
    data.set(`${GUEST_DRAWINGS_PREFIX}k`, { 0: [item("x")], 2: [] } as unknown as GuestPages);
    expect(await new GuestDrawings("k", backend).load()).toEqual({});
  });
});
