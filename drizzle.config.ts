import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit nu citește singur .env.local. În CI variabilele vin din mediu,
 * așa că încărcăm fișierul doar dacă există.
 */
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

/**
 * Migrările rulează pe conexiunea directă (non-pooled). Pooler-ul Neon nu
 * suportă unele comenzi DDL în tranzacție.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
