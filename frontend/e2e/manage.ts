import { spawnSync } from "node:child_process";
import { join } from "node:path";

/**
 * `manage.py` buyrug'ini backend'da ishga tushiradi: odatda compose konteynerida; lokal `runserver`
 * bilan ishlaganda `E2E_MANAGE_CWD=<backend papkasi>` bering (muhit o'zgaruvchilari shu jarayondan
 * meros bo'ladi, masalan `DATABASE_URL`).
 */
export function manage(args: string[], env: Record<string, string> = {}): string {
  const local = process.env.E2E_MANAGE_CWD;
  const result = local
    ? spawnSync("uv", ["run", "python", "manage.py", ...args], {
        cwd: local,
        env: { ...process.env, ...env },
        encoding: "utf8",
      })
    : spawnSync(
        "docker",
        [
          "compose",
          "exec",
          "-T",
          ...Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
          "backend",
          "python",
          "manage.py",
          ...args,
        ],
        { cwd: join(process.cwd(), ".."), encoding: "utf8" },
      );
  if (result.status !== 0) {
    // Muhit qiymatlari (parol) xato matniga tushmasin: faqat buyruq nomi va chiqish.
    throw new Error(`manage.py ${args[0]} bajarilmadi:\n${result.stdout}${result.stderr}`);
  }
  return result.stdout;
}
