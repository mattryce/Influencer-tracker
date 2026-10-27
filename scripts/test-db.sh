#!/usr/bin/env bash
# Spins up a throwaway local Postgres, applies a Supabase stub + all migrations + seed,
# then runs the database tests (RLS, triggers, constraints) against it.
# Usage: npm run test:db   (requires Postgres server binaries: initdb/pg_ctl)
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${TEST_PG_PORT:-54329}"
DATA="$(mktemp -d)/pgdata"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  chown -R postgres "$(dirname "$DATA")"
  RUN_AS=(su postgres -c)
fi
run() { if [ ${#RUN_AS[@]} -gt 0 ]; then "${RUN_AS[@]}" "$*"; else bash -c "$*"; fi; }

run "$PGBIN/initdb -D $DATA -U postgres -A trust >/dev/null"
run "$PGBIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp' -l $DATA/log -w start >/dev/null"
trap 'run "$PGBIN/pg_ctl -D $DATA -m immediate stop >/dev/null" || true' EXIT

URL="postgresql://postgres@127.0.0.1:$PORT/postgres"
psql -q -v ON_ERROR_STOP=1 "$URL" -f tests/db/supabase-stub.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 "$URL" -f "$f" >/dev/null
done
psql -q -v ON_ERROR_STOP=1 "$URL" -f supabase/seed.sql >/dev/null

if [ -n "${KEEP_DB:-}" ]; then echo "DB at $URL"; trap - EXIT; exit 0; fi
TEST_DATABASE_URL="$URL" npx vitest run --config vitest.db.config.mts "$@"
