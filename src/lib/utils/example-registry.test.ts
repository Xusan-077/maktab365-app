import { afterEach, describe, expect, it } from "vitest";
import {
  hidePreviousStep,
  registerExample,
  revealNextStep,
  type ExampleHandle,
} from "./example-registry";

/** Oddiy hisoblagich: `shown` ochilgan qadamlar soni. */
function fakeExample(total: number) {
  const state = { shown: 1 };
  const handle: ExampleHandle = {
    element: null,
    hasNext: () => state.shown < total,
    hasPrevious: () => state.shown > 1,
    next: () => void state.shown++,
    previous: () => void state.shown--,
  };
  return { state, handle };
}

const cleanups: Array<() => void> = [];
const add = (handle: ExampleHandle) => cleanups.push(registerExample(handle));
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

describe("example registry", () => {
  it("birinchi tugallanmagan misolni ketma-ket ochadi", () => {
    const a = fakeExample(2);
    const b = fakeExample(3);
    add(a.handle);
    add(b.handle);
    expect(revealNextStep()).toBe(true);
    expect([a.state.shown, b.state.shown]).toEqual([2, 1]);
    expect(revealNextStep()).toBe(true);
    expect([a.state.shown, b.state.shown]).toEqual([2, 2]);
  });

  it("hamma qadam ochilgan bo'lsa false qaytaradi", () => {
    const a = fakeExample(1);
    add(a.handle);
    expect(revealNextStep()).toBe(false);
  });

  it("orqaga: eng pastki misolning oxirgi qadamini yashiradi", () => {
    const a = fakeExample(3);
    const b = fakeExample(3);
    add(a.handle);
    add(b.handle);
    a.state.shown = 3;
    b.state.shown = 2;
    expect(hidePreviousStep()).toBe(true);
    expect([a.state.shown, b.state.shown]).toEqual([3, 1]);
    expect(hidePreviousStep()).toBe(true);
    expect([a.state.shown, b.state.shown]).toEqual([2, 1]);
    a.state.shown = 1;
    expect(hidePreviousStep()).toBe(false);
  });

  it("ro'yxatdan chiqarilgan misolga tegmaydi", () => {
    const a = fakeExample(3);
    const off = registerExample(a.handle);
    off();
    expect(revealNextStep()).toBe(false);
    expect(a.state.shown).toBe(1);
  });
});
