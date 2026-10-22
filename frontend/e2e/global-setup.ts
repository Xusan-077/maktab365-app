import { manage } from "./manage";

/**
 * E2E haqiqiy backend bilan ishlaydi (`docker compose up -d`, yoki lokal `runserver` +
 * `E2E_MANAGE_CWD=<backend papkasi>`). Fanlar (admin wizard ro'yxati) `seed_subjects` bilan
 * yuklanadi: idempotent, mavjud fanlarga tegmaydi. `E2E_SKIP_SEED=1` — o'tkazib yuborish.
 * Backend'da `SHOW_DRAFTS_PUBLICLY=true` kerak emas: kitoblar admin orqali nashr qilinadi.
 */
export default async function globalSetup() {
  const api = (process.env.E2E_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

  const health = await fetch(`${api}/api/v1/health/`).catch(() => null);
  if (!health?.ok) {
    throw new Error(`${api} da backend javob bermadi (docker compose up -d yoki runserver).`);
  }

  if (!process.env.E2E_SKIP_SEED) manage(["seed_subjects"]);
}
