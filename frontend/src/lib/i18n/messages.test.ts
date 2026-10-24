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

  it("uz-Cyrl: til nomlari o'z holicha, matn kirillda", async () => {
    const cyrl = (await getMessages("uz-Cyrl")) as MessageTree & {
      nav: { login: string };
      language: { names: Record<string, string> };
    };
    expect(cyrl.nav.login).toBe(transliterateMessage("Kirish"));
    expect(cyrl.language.names.en).toBe("English");
  });

  it("uz-Cyrl: ICU o'zgaruvchilari uz bilan bir xil (qo'lda tahrirda buzilmasin)", async () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((match) => match[1]).sort();
    const flatten = (tree: MessageTree, prefix = ""): Record<string, string> =>
      Object.fromEntries(
        Object.entries(tree).flatMap(([key, value]) =>
          typeof value === "string"
            ? [[`${prefix}${key}`, value]]
            : Object.entries(flatten(value, `${prefix}${key}.`)),
        ),
      );
    const uz = flatten((await getMessages("uz")) as MessageTree);
    const cyrl = flatten((await getMessages("uz-Cyrl")) as MessageTree);
    for (const [path, text] of Object.entries(uz)) {
      expect(placeholders(cyrl[path]), path).toEqual(placeholders(text));
    }
  });
});
