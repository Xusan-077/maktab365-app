/** Kirill → lotin vektorlari: `contracts/fixtures/translit.json`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cyrillicToLatin, normalizeSearchText } from "./translit";

const vectors = JSON.parse(
  readFileSync(join(process.cwd(), "..", "contracts", "fixtures", "translit.json"), "utf8"),
) as { cyrillicToLatin: [string, string][]; searchNormalize: [string, string][] };

describe("cyrillicToLatin (umumiy vektorlar)", () => {
  it.each(vectors.cyrillicToLatin)("%s → %s", (cyrillic, latin) => {
    expect(cyrillicToLatin(cyrillic)).toBe(latin);
  });
});

describe("normalizeSearchText (umumiy vektorlar)", () => {
  it.each(vectors.searchNormalize)("%j → %j", (raw, normalized) => {
    expect(normalizeSearchText(raw)).toBe(normalized);
  });
});
