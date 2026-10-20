import { spawnSync } from "node:child_process";
import { join } from "node:path";

/**
 * E2E katalog haqiqiy backend'dagi kontentdan o'qiydi: `frontend/src/content` compose backend'ga
 * (`/content`) ulangan va shu yerda yuklanadi. Backend boshqacha ishga tushirilgan bo'lsa
 * (masalan, lokal `runserver`), kontentni o'zingiz yuklang (`npm run content:import`) va
 * `E2E_SKIP_IMPORT=1` bering.
 */
export default async function globalSetup() {
  const api = (process.env.E2E_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

  if (!process.env.E2E_SKIP_IMPORT) {
    const result = spawnSync(
      "docker",
      ["compose", "exec", "-T", "backend", "python", "manage.py", "import_content", "/content"],
      { cwd: join(process.cwd(), ".."), encoding: "utf8" },
    );
    if (result.status !== 0) {
      throw new Error(`Kontent import qilinmadi:\n${result.stdout}${result.stderr}`);
    }
  }

  const response = await fetch(`${api}/api/v1/books/?topics_ready=true`);
  const data = (await response.json()) as { count?: number };
  if (!response.ok || (data.count ?? 0) < 4) {
    throw new Error(
      `${api} da import qilingan kontent topilmadi (kutilgan: kamida 4 ta kitob). ` +
        "Backend'da SHOW_DRAFTS_PUBLICLY=true bo'lishi va `import_content` bajarilgan bo'lishi kerak.",
    );
  }
}
