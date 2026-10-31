import { beforeEach, describe, expect, it } from "vitest";
import type { Annotation } from "@/lib/books/annotations";
import {
  selectCanRedo,
  selectCanUndo,
  selectPageItems,
  useBookAnnotationsStore,
} from "./book-annotations.store";

const stroke = (id: string): Annotation => ({
  id,
  type: "drawing",
  data: { tool: "pen", color: "ink", width: 0.004, points: [[0.1, 0.1, 0.5]] },
});

const store = () => useBookAnnotationsStore.getState();

describe("book-annotations.store", () => {
  beforeEach(() => {
    useBookAnnotationsStore.setState({
      bookId: null,
      tool: "none",
      selectedId: null,
      pages: {},
      lastChange: null,
    });
    store().attach("book-1");
  });

  it("serverdan kelgan ro'yxat tarix yaratmaydi va sinxronlashga chiqmaydi", () => {
    store().hydrate(3, [stroke("a")]);
    expect(selectPageItems(3)(store())).toHaveLength(1);
    expect(selectCanUndo(3)(store())).toBe(false);
    expect(store().lastChange).toBeNull();
  });

  it("hydrate mahalliy o'zgarishni ustidan yozmaydi", () => {
    store().commit(1, [stroke("local")]);
    store().hydrate(1, []);
    expect(selectPageItems(1)(store()).map((item) => item.id)).toEqual(["local"]);
  });

  it("commit → undo → redo va har biri sinxronlash o'zgarishini beradi", () => {
    store().commit(2, [stroke("a")]);
    store().commit(2, [stroke("a"), stroke("b")]);
    expect(store().lastChange).toMatchObject({ bookId: "book-1", page: 2 });

    expect(store().undo(2)).toBe(true);
    expect(selectPageItems(2)(store()).map((item) => item.id)).toEqual(["a"]);
    expect(selectCanRedo(2)(store())).toBe(true);

    expect(store().redo(2)).toBe(true);
    expect(selectPageItems(2)(store())).toHaveLength(2);
    expect(store().lastChange?.seq).toBe(4);
  });

  it("tarix bet almashganda saqlanadi, betlar bir-biriga aralashmaydi", () => {
    store().commit(1, [stroke("a")]);
    store().commit(2, [stroke("b")]);
    store().hydrate(5, []);
    expect(store().undo(1)).toBe(true);
    expect(selectPageItems(1)(store())).toHaveLength(0);
    expect(selectPageItems(2)(store())).toHaveLength(1);
    expect(store().undo(5)).toBe(false);
  });

  it("bo'sh tarixda undo/redo hech narsa qilmaydi", () => {
    expect(store().undo(9)).toBe(false);
    expect(store().redo(9)).toBe(false);
    expect(store().lastChange).toBeNull();
  });

  it("boshqa kitobga o'tganda holat tozalanadi, o'sha kitobda — saqlanadi", () => {
    store().commit(1, [stroke("a")]);
    store().attach("book-1");
    expect(selectPageItems(1)(store())).toHaveLength(1);
    store().attach("book-2");
    expect(selectPageItems(1)(store())).toHaveLength(0);
  });

  it("asbob almashganda tanlov bekor bo'ladi", () => {
    store().select("a");
    store().setTool("pen");
    expect(store().selectedId).toBeNull();
  });
});
