import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  mergePdfPosition,
  mergeReadStatus,
  reachedEnd,
  resumePage,
  type PdfPosition,
  type ReadStatus,
} from "./progress";

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

interface ReadCase {
  name: string;
  page_count: number;
  account: ReadStatus | null;
  guest_page: number | null;
  merged_status: ReadStatus;
}

const readFixture = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "../../../../contracts/fixtures/merge-pdf-read-status.json"),
    "utf8",
  ),
) as { cases: ReadCase[] };

describe("mergeReadStatus — backend bilan umumiy shartnoma", () => {
  it.each(readFixture.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(mergeReadStatus(c.account, c.guest_page, c.page_count)).toBe(c.merged_status);
  });

  it("reachedEnd: oxirgi bet va undan keyingisi; bo'sh kitob hech qachon", () => {
    expect(reachedEnd(10, 10)).toBe(true);
    expect(reachedEnd(11, 10)).toBe(true);
    expect(reachedEnd(9, 10)).toBe(false);
    expect(reachedEnd(1, 0)).toBe(false);
  });
});
