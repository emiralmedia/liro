#!/usr/bin/env node
/**
 * Utilitare pentru baza locală de dezvoltare.
 *
 * Pachetul `embedded-postgres` livrează doar `initdb`, `pg_ctl` și `postgres` —
 * nu și `createdb` sau `psql`. Le înlocuim aici, prin clientul `postgres` pe
 * care aplicația îl folosește oricum.
 *
 *   node scripts/db-util.mjs ensure-db          creează baza 'liro' dacă lipsește
 *   node scripts/db-util.mjs sql "SELECT 1"     rulează o interogare
 *   node scripts/db-util.mjs tables             listează tabelele
 */
import postgres from "postgres";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PGPORT ?? 5433);
const USER = "postgres";
const TARGET_DB = "liro";

const connect = (database) =>
  postgres({ host: HOST, port: PORT, user: USER, database, max: 1, onnotice: () => {} });

async function ensureDb() {
  const sql = connect("postgres");
  try {
    const rows = await sql`SELECT 1 FROM pg_database WHERE datname = ${TARGET_DB}`;
    if (rows.length > 0) {
      console.log(`Baza '${TARGET_DB}' există deja.`);
      return;
    }
    // Numele bazei nu poate fi parametru legat într-un CREATE DATABASE.
    // TARGET_DB este o constantă din acest fișier, nu intrare de la utilizator.
    await sql.unsafe(`CREATE DATABASE "${TARGET_DB}"`);
    console.log(`Baza '${TARGET_DB}' a fost creată.`);
  } finally {
    await sql.end();
  }
}

async function runSql(query) {
  const sql = connect(TARGET_DB);
  try {
    const rows = await sql.unsafe(query);
    if (Array.isArray(rows) && rows.length > 0) console.table(rows);
    else console.log("(fără rânduri)");
  } finally {
    await sql.end();
  }
}

async function listTables() {
  const sql = connect(TARGET_DB);
  try {
    const rows = await sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' ORDER BY tablename
    `;
    console.log(rows.map((r) => r.tablename).join("\n") || "(nicio tabelă)");
    console.log(`\n${rows.length} tabele`);
  } finally {
    await sql.end();
  }
}

const [command, ...rest] = process.argv.slice(2);
try {
  switch (command) {
    case "ensure-db":
      await ensureDb();
      break;
    case "sql":
      await runSql(rest.join(" "));
      break;
    case "tables":
      await listTables();
      break;
    default:
      console.error("Utilizare: node scripts/db-util.mjs {ensure-db|sql <query>|tables}");
      process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
