import { describe, expect, it } from "vitest";
import { formatBytes } from "./bytes";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [-5, "0 B"],
    [512, "512 B"],
    [1536, "1.5 KB"],
    [1024 * 1024, "1 MB"],
    [100 * 1024 * 1024, "100 MB"],
    [5.25 * 1024 * 1024 * 1024, "5.3 GB"],
  ])("%d → %s", (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });
});
