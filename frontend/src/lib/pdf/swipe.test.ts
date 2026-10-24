import { describe, expect, it } from "vitest";
import { swipeDirection } from "./swipe";

describe("swipeDirection", () => {
  it("chapga surish — keyingi, o'ngga — oldingi", () => {
    expect(swipeDirection(-120, 10, 200)).toBe("next");
    expect(swipeDirection(120, -10, 200)).toBe("prev");
  });

  it("qisqa harakat swipe emas", () => {
    expect(swipeDirection(-30, 0, 100)).toBeNull();
    expect(swipeDirection(-49, 0, 100)).toBeNull();
    expect(swipeDirection(-50, 0, 100)).toBe("next"); // 50px chegarasi
  });

  it("asosan tikka harakat (scroll) swipe emas", () => {
    expect(swipeDirection(-80, 70, 200)).toBeNull();
  });

  it("sekin harakat swipe emas", () => {
    expect(swipeDirection(-200, 0, 2000)).toBeNull();
  });
});
