import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testele de integrare au nevoie de DATABASE_URL. Fișierul de configurare se
// evaluează înaintea testelor, deci aici încărcarea e la timp. În CI
// variabilele vin din mediu, așa că îl citim doar dacă există.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Testele de integrare cer o bază Postgres (ramură Neon efemeră).
    // În CI rulează separat, după ce DATABASE_URL_UNPOOLED e setat.
    exclude: ["node_modules", ".next", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      thresholds: {
        // Logica de corectare și autorizare nu are voie să regreseze.
        lines: 85,
        functions: 85,
      },
    },
  },
});
