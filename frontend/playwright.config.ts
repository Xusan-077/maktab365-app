import { defineConfig, devices } from "@playwright/test";

/**
 * E2E: haqiqiy backend (docker compose: `docker compose up -d`; dev sozlamasi email kodini
 * `/api/v1/dev/otp/` orqali ko'rsatadi) + frontend production build.
 * `make e2e` yoki `npx playwright test`.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    locale: "uz",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/uz/kirish`,
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
    env: {
      // Katalog hali mock; akkaunt (auth, profil, onboarding) — haqiqiy backend.
      NEXT_PUBLIC_API_MODE: "mock",
      // Telegram widget konteyneri (skript tashqi tarmoqdan yuklanadi, testlar unga tayanmaydi).
      NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: "maktab365_e2e_bot",
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      API_URL: process.env.E2E_API_URL ?? "http://localhost:8000",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-only-auth-secret-0123456789abcdef",
      AUTH_URL: BASE_URL,
      BACKEND_FORWARD_SECRET: process.env.BACKEND_FORWARD_SECRET ?? "dev-forward-secret",
    },
  },
});
