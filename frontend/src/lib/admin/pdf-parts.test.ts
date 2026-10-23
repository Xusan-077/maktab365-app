import { describe, expect, it } from "vitest";
import { MAX_PARTS, partCountFor, partSizeFor } from "./pdf-parts";

const MIB = 1024 * 1024;

// Backend `test_part_size_scales_with_file_size` bilan bir xil jadval.
describe("partSizeFor / partCountFor", () => {
  it.each([
    [1, 8 * MIB, 1],
    [8 * MIB, 8 * MIB, 1],
    [8 * MIB + 1, 8 * MIB, 2],
    [5 * 1024 ** 3, 8 * MIB, 640], // 5 GB
    [80_000 * MIB, 8 * MIB, 10_000],
    [80_000 * MIB + 1, 9 * MIB, 8889],
    [100 * 1024 ** 3, 11 * MIB, 9310], // 100 GB
  ])("%d bayt → bo'lak %d, soni %d", (size, part, count) => {
    expect(partSizeFor(size)).toBe(part);
    expect(partCountFor(size, part)).toBe(count);
    expect(count).toBeLessThanOrEqual(MAX_PARTS);
  });

  it("eng kichik bo'lak hajmi sozlanadi", () => {
    expect(partSizeFor(MIB, 16 * MIB)).toBe(16 * MIB);
  });
});
