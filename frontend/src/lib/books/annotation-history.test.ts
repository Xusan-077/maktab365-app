import { describe, expect, it } from "vitest";
import {
  canRedo,
  canUndo,
  commitHistory,
  createHistory,
  HISTORY_LIMIT,
  redoHistory,
  replaceItems,
  undoHistory,
} from "./annotation-history";
import type { Annotation } from "./annotations";

const note = (id: string): Annotation => ({
  id,
  type: "text",
  data: { x: 0.1, y: 0.1, text: id, color: "ink", size: 0.03 },
});

describe("annotation history", () => {
  it("commit eski holatni tarixga qo'yadi va 'qayta' ni tozalaydi", () => {
    let history = createHistory();
    history = commitHistory(history, [note("a")]);
    history = commitHistory(history, [note("a"), note("b")]);
    expect(history.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(canUndo(history)).toBe(true);
    expect(canRedo(history)).toBe(false);

    history = undoHistory(history);
    expect(canRedo(history)).toBe(true);
    history = commitHistory(history, [note("c")]);
    expect(canRedo(history)).toBe(false);
  });

  it("undo va redo bir-birini to'liq qaytaradi", () => {
    const empty = createHistory();
    const first = commitHistory(empty, [note("a")]);
    const second = commitHistory(first, [note("a"), note("b")]);

    const undone = undoHistory(undoHistory(second));
    expect(undone.items).toEqual([]);
    expect(canUndo(undone)).toBe(false);

    const redone = redoHistory(redoHistory(undone));
    expect(redone.items).toEqual(second.items);
    expect(canRedo(redone)).toBe(false);
  });

  it("bo'sh tarixda undo/redo hech narsa qilmaydi (bir xil obyekt)", () => {
    const history = createHistory([note("a")]);
    expect(undoHistory(history)).toBe(history);
    expect(redoHistory(history)).toBe(history);
  });

  it("o'zgarmagan ro'yxat tarixga qadam qo'shmaydi", () => {
    const history = commitHistory(createHistory(), [note("a")]);
    expect(commitHistory(history, history.items)).toBe(history);
  });

  it("tarix chegaralangan: eng eski qadamlar tashlanadi", () => {
    let history = createHistory();
    for (let step = 0; step < HISTORY_LIMIT + 20; step += 1) {
      history = commitHistory(history, [note(String(step))]);
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
  });

  it("serverdan yuklash tarixga qadam qo'shmaydi", () => {
    const history = commitHistory(createHistory(), [note("a")]);
    const loaded = replaceItems(history, [note("server")]);
    expect(loaded.items[0].id).toBe("server");
    expect(loaded.past).toBe(history.past);
  });
});
