import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const SCRIPT = join(process.cwd(), "scripts", "validate-content.ts");
const roots: string[] = [];

/** `npm run content:validate` skriptini berilgan kontent papkasida ishga tushiradi. */
function runValidator(files: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), "content-"));
  roots.push(root);
  for (const [path, data] of Object.entries(files)) {
    const file = join(root, path);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data));
  }
  const result = spawnSync(process.execPath, ["--import", "tsx", SCRIPT], {
    env: { ...process.env, CONTENT_ROOT: root },
    encoding: "utf8",
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe("content:validate skripti", () => {
  it("xato bo'lsa fayl nomi va maydon yo'lini ko'rsatib, exit code 1 bilan tugaydi", () => {
    const { status, output } = runValidator({
      "tarix/history-9/ch/chapter.json": { order: 1, title: { uz: "Bob" } },
      "tarix/history-9/ch/mavzu.json": {
        status: "draft",
        order: 1,
        title: { uz: "Mavzu" },
        blocks: [{ id: "goal", type: "goal", text: { uz: "Maqsad" } }],
      },
    });
    expect(status).toBe(1);
    expect(output).toContain("src/content/tarix/history-9/ch/mavzu.json");
    expect(output).toContain("blocks:");
    expect(output).toContain("kamida 3 ta mashq kerak");
  });

  it("buzuq JSON ham fayl nomi bilan xabar qilinadi", () => {
    const { status, output } = runValidator({ "tarix/history-9/ch/buzuq.json": "{ nope" });
    expect(status).toBe(1);
    expect(output).toContain("buzuq.json");
    expect(output).toContain("(JSON)");
  });

  it("registry'da yo'q fayl xabar qilinadi", () => {
    const { status, output } = runValidator({
      "tarix/history-9/ch/chapter.json": { order: 1, title: { uz: "Bob" } },
    });
    expect(status).toBe(1);
    expect(output).toContain("registry");
  });
});
