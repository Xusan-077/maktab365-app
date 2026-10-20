import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Komponent testlari (`*.test.tsx`) faylning o'zida `// @vitest-environment jsdom` bilan.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // next-auth / next-intl `next/server`, `next/navigation` kabi kengaytmasiz yo'llarni import qiladi.
    server: { deps: { inline: [/next-auth/, /next-intl/, /@auth[\\/]core/] } },
  },
});
