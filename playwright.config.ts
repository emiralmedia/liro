import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

/** Fișierul în care serverul de test scrie linkurile magice (vezi src/lib/auth.ts). */
export const MAGIC_LINK_FILE = ".tools/magic-links.txt";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // testele împart o singură bază de date
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      // Profesorul predă de pe laptop.
      name: "profesor-desktop",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /.*(profesor|a11y|flux-complet)\.spec\.ts/,
    },
    {
      // Cursantul lucrează de pe telefon.
      name: "cursant-mobil",
      use: { ...devices["Pixel 7"] },
      testMatch: /.*cursant\.spec\.ts/,
    },
  ],
  webServer: {
    // Deliberat serverul de dezvoltare: în producție `src/lib/auth.ts` refuză
    // să pornească fără cheie de email, iar linkul magic nu se scrie niciodată
    // pe disc. Testele au nevoie de exact acel comportament de dezvoltare.
    command: `pnpm exec next dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      AUTH_URL: BASE_URL,
      AUTH_TRUST_HOST: "true",
      AUTH_DEV_LINK_FILE: MAGIC_LINK_FILE,
    },
  },
});
