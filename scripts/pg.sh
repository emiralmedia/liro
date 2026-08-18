#!/usr/bin/env bash
# Postgres local pentru dezvoltare, fără Docker și fără sudo.
#
# Folosește binarele arm64 aduse de pachetul `embedded-postgres`. Datele stau în
# .tools/pgdata (gitignorat) — se șterg fără urmă cu `pnpm db:local reset`.
#
# În CI nu se folosește: acolo rulează serviciul postgres:16 din workflow.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGDATA="$ROOT/.tools/pgdata"
PGPORT="${PGPORT:-5433}"
PGUSER_LOCAL="postgres"
PGDB="liro"
LOGFILE="$ROOT/.tools/postgres.log"

# Rezolvă directorul cu binare fără a fixa versiunea în cod.
PGBIN="$(find "$ROOT/node_modules/.pnpm" -type d -path "*@embedded-postgres*/native/bin" 2>/dev/null | head -1)"
if [[ -z "$PGBIN" ]]; then
  echo "Binarele Postgres lipsesc. Rulează întâi: pnpm install" >&2
  exit 1
fi

is_running() {
  "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1
}

cmd_init() {
  if [[ -f "$PGDATA/PG_VERSION" ]]; then
    echo "Baza există deja în .tools/pgdata (folosește 'reset' pentru a o reface)."
    return 0
  fi
  mkdir -p "$ROOT/.tools"
  echo "$PGUSER_LOCAL" > "$ROOT/.tools/.pgpass_tmp"
  "$PGBIN/initdb" -D "$PGDATA" -U "$PGUSER_LOCAL" \
    --auth-local=trust --auth-host=trust \
    --encoding=UTF8 --locale=C >/dev/null
  rm -f "$ROOT/.tools/.pgpass_tmp"
  echo "Cluster inițializat în .tools/pgdata"
}

cmd_start() {
  cmd_init
  if is_running; then
    echo "Postgres rulează deja pe portul $PGPORT."
    return 0
  fi
  "$PGBIN/pg_ctl" -D "$PGDATA" -l "$LOGFILE" \
    -o "-p $PGPORT -k $PGDATA -c listen_addresses=127.0.0.1" -w start >/dev/null
  # Pachetul nu livrează `createdb`; folosim clientul Node.
  PGPORT="$PGPORT" node "$ROOT/scripts/db-util.mjs" ensure-db
  echo "Postgres pornit pe 127.0.0.1:$PGPORT, baza '$PGDB'."
  echo "DATABASE_URL=postgresql://$PGUSER_LOCAL@127.0.0.1:$PGPORT/$PGDB"
}

cmd_stop() {
  if ! is_running; then
    echo "Postgres nu rulează."
    return 0
  fi
  "$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop >/dev/null
  echo "Postgres oprit."
}

cmd_status() {
  if is_running; then
    echo "rulează (port $PGPORT)"
  else
    echo "oprit"
  fi
}

cmd_reset() {
  if is_running; then cmd_stop; fi
  rm -rf "$PGDATA" "$LOGFILE"
  echo "Datele locale au fost șterse."
  cmd_start
}

cmd_sql() {
  shift || true
  PGPORT="$PGPORT" node "$ROOT/scripts/db-util.mjs" sql "$@"
}

cmd_tables() {
  PGPORT="$PGPORT" node "$ROOT/scripts/db-util.mjs" tables
}

case "${1:-start}" in
  init) cmd_init ;;
  start) cmd_start ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  reset) cmd_reset ;;
  sql) cmd_sql "$@" ;;
  tables) cmd_tables ;;
  *)
    echo "Utilizare: pnpm db:local {start|stop|status|reset|sql <query>|tables}" >&2
    exit 1
    ;;
esac
