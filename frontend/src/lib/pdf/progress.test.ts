import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mergePdfPosition, resumePage, type PdfPosition } from "./progress";

interface Entry {
  last_page: number;
  updated_at: string;
}

interface Case {
  name: string;
  account: Entry | null;
  guest: Entry;
  merged: Entry;
}

const fixture = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "../../../../contracts/fixtures/merge-pdf-progress.json"),
    "utf8",
  ),
) as { cases: Case[] };

const pos = (item: Entry | null): PdfPosition | null =>
  item && { page: item.last_page, updatedAt: item.updated_at };

describe("mergePdfPosition — backend bilan umumiy shartnoma", () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(mergePdfPosition(pos(c.account), pos(c.guest))).toEqual(pos(c.merged));
  });

  it("ikkalasi ham yo'q bo'lsa null", () => {
    expect(mergePdfPosition(null, null)).toBeNull();
  });
});

describe("resumePage", () => {
  it("saqlangan sahifa kitob uzunligiga tuzatiladi", () => {
    expect(resumePage({ page: 18, updatedAt: "2026-01-01T00:00:00Z" }, 10)).toBe(10);
    expect(resumePage({ page: 4, updatedAt: "2026-01-01T00:00:00Z" }, 10)).toBe(4);
  });

  it("pozitsiya yo'q — 1", () => {
    expect(resumePage(null, 10)).toBe(1);
  });
});
