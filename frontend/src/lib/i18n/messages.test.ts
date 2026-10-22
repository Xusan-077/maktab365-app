import { describe, expect, it } from "vitest";
import { locales } from "./config";
import { getMessages } from "./messages";
import { transliterateMessage, type MessageTree } from "./translit";

function keyPaths(tree: MessageTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : keyPaths(value, path);
  });
}

describe("messages", () => {
  it("barcha tillarda kalitlar uz bilan bir xil", async () => {
    const base = keyPaths((await getMessages("uz")) as MessageTree).sort();
    for (const locale of locales) {
      expect(keyPaths((await getMessages(locale)) as MessageTree).sort()).toEqual(base);
    }
  });

  it("uz-Cyrl uz'dan generatsiya qilinadi, til nomlari esa o'z holicha", async () => {
    const cyrl = (await getMessages("uz-Cyrl")) as MessageTree & {
      nav: { login: string };
      language: { names: Record<string, string> };
    };
    expect(cyrl.nav.login).toBe(transliterateMessage("Kirish"));
    expect(cyrl.language.names.en).toBe("English");
  });
});
