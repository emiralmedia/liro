import { defineConfig } from "drizzle-kit";

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
