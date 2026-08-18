import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Client Postgres pentru runtime.
 *
 * Rulează prin pooler-ul Neon (`DATABASE_URL`). Migrările și testele de
 * integrare folosesc conexiunea directă (`DATABASE_URL_UNPOOLED`), fiindcă
 * pooler-ul nu suportă tot DDL-ul în tranzacție.
 *
 * Fișierul este server-only: importul lui într-o componentă client ar expune
 * credențialele bazei. Nu-l importa în afara server actions, route handlers,
 * server components sau scripturi.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL lipsește. Copiază .env.example în .env.local și completează-l.",
  );
}

/**
 * În dev, Next.js reîncarcă modulele la fiecare modificare; fără cache pe
 * globalThis am deschide conexiuni noi până la epuizarea limitei Neon.
 */
const globalForDb = globalThis as unknown as {
  __liroSql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDb.__liroSql ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 10 : 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__liroSql = sql;
}

export const db = drizzle(sql, { schema });
export { schema };
export type Db = typeof db;
