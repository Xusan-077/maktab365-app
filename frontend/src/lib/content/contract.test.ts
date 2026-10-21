/**
 * Shartnoma testi: ildizdagi `contracts/fixtures/` namunalari. Backend
 * (`backend/apps/content/tests/test_schemas.py`) xuddi shu fayllar va kutilgan yo'llar bilan tekshiriladi.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateTopicFile } from "./validate";

const FIXTURES = join(process.cwd(), "..", "contracts", "fixtures");
const load = (name: string): unknown => JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));

const EXPECTED = Object.fromEntries(
  Object.entries(load("expected.json") as Record<string, string[] | string>).filter(
    ([name]) => name !== "_comment",
  ),
);
const paths = (name: string) => [...new Set(validateTopicFile(load(name)).map((i) => i.path))];

describe("kontent shartnomasi (contracts/fixtures)", () => {
  it("to'g'ri namuna xatosiz o'tadi", () => {
    expect(validateTopicFile(load("topic-valid.json"))).toEqual([]);
  });

  it("har bir noto'g'ri namuna ro'yxatda bor", () => {
    const onDisk = readdirSync(FIXTURES).filter((name) => name.startsWith("topic-invalid-"));
    expect(onDisk.sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))("%s: kutilgan xato yo'llari", (name, expected) => {
    expect(paths(name).sort()).toEqual([...(expected as string[])].sort());
  });
});
