/**
 * M1 smoke: ishga tushgan stack (`make dev`) ni tekshiradi.
 * 1) backend /api/v1/health/ → "ok"; 2) frontend /uz/dev/api-status backend "ok" ko'rsatadi.
 * Manzillar: API_URL (default http://localhost:8000), FRONTEND_URL (default http://localhost:3000).
 */
const apiUrl = (process.env.API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const frontendUrl = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/+$/, "");

function pass(message: string) {
  process.stdout.write(`ok: ${message}\n`);
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function main() {
  const health = await fetch(`${apiUrl}/api/v1/health/`).catch(() => null);
  if (!health) fail(`backend javob bermadi (${apiUrl})`);
  const body = (await health.json()) as { status?: string };
  if (body.status !== "ok") fail(`backend holati "ok" emas: ${JSON.stringify(body)}`);
  pass("backend /health/");

  const page = await fetch(`${frontendUrl}/uz/dev/api-status`).catch(() => null);
  if (!page?.ok) fail(`/dev/api-status ochilmadi (${frontendUrl})`);
  const html = await page.text();
  const badge = /data-testid="api-status">[\s\S]*?<span[^>]*>([^<]*)<\/span>/.exec(html)?.[1];
  if (badge !== "ok") fail(`/dev/api-status backend "ok" ko'rsatmadi (${badge ?? "topilmadi"})`);
  pass("/dev/api-status");
}

void main();
