/**
 * Vercel production build'idan oldin: backend kerakli `api_revision` bilan chiqquncha kutadi.
 * Tartib: backend (Railway, migratsiyalar bilan) birinchi, frontend keyin. Backend chiqmasa build
 * yiqiladi va eski frontend prod'da qoladi (yangi frontend eski API'ni chaqirib qolmaydi).
 *
 * Faqat `VERCEL_ENV=production` da ishlaydi. O'tkazib yuborish: `SKIP_BACKEND_CHECK=1`.
 * Kutish: `BACKEND_WAIT_MINUTES` (default 12).
 */
import {
  apiRevisionOf,
  isCompatible,
  REQUIRED_API_REVISION,
} from "../src/lib/deploy/backend-revision";
import type { BackendHealth } from "../src/lib/deploy/backend-revision";

const { VERCEL_ENV, SKIP_BACKEND_CHECK, API_URL, BACKEND_WAIT_MINUTES } = process.env;
const INTERVAL_MS = 15_000;
const log = (message: string) =>
  process.stdout.write(`${message}
`);

async function readHealth(base: string): Promise<BackendHealth | null> {
  try {
    const response = await fetch(new URL("/api/v1/health/", base), {
      signal: AbortSignal.timeout(8_000),
    });
    return (await response.json()) as BackendHealth;
  } catch {
    return null;
  }
}

async function main() {
  if (VERCEL_ENV !== "production" || SKIP_BACKEND_CHECK === "1") {
    log(`[backend-check] o'tkazib yuborildi (VERCEL_ENV=${VERCEL_ENV ?? "-"})`);
    return;
  }
  if (!API_URL)
    throw new Error("[backend-check] API_URL berilmagan (Vercel → Environment Variables)");

  const deadline = Date.now() + Number(BACKEND_WAIT_MINUTES ?? 12) * 60_000;
  for (;;) {
    const health = await readHealth(API_URL);
    if (health && isCompatible(health, REQUIRED_API_REVISION)) {
      log(
        `[backend-check] backend tayyor: api_revision=${apiRevisionOf(health)} (kerak: ${REQUIRED_API_REVISION})`,
      );
      return;
    }
    const seen = health ? `api_revision=${apiRevisionOf(health)}` : "javob yo'q";
    if (Date.now() > deadline) {
      throw new Error(
        `[backend-check] backend ${REQUIRED_API_REVISION}-versiyaga yetmadi (${seen}). ` +
          "Railway deploy'ini tekshiring; kerak bo'lsa SKIP_BACKEND_CHECK=1.",
      );
    }
    log(`[backend-check] kutilmoqda: ${seen}, kerak: ${REQUIRED_API_REVISION}`);
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
