import { describe, expect, it } from "vitest";
import { mergeAttempts, nextReadStatus } from "./status";

describe("nextReadStatus", () => {
  it("oxirigacha aylantirilsa o'qilgan, aks holda boshlangan", () => {
    expect(nextReadStatus(undefined, 0.2)).toBe("started");
    expect(nextReadStatus(undefined, 0.98)).toBe("completed");
  });

  it("mavjud holatdan pastga tushmaydi", () => {
    expect(nextReadStatus("completed", 0.1)).toBe("completed");
    expect(nextReadStatus("started", 0.1)).toBe("started");
  });
});

describe("mergeAttempts", () => {
  it("har mashq uchun eng kattasini oladi", () => {
    expect(mergeAttempts({ a: 2, b: 1 }, { a: 1, c: 3 })).toEqual({ a: 2, b: 1, c: 3 });
    expect(mergeAttempts(undefined, undefined)).toEqual({});
  });
});
