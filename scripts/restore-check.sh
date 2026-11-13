#!/usr/bin/env bash
# Restore drill (AC-14): restores a backup into a throwaway database and compares row counts
# of every table with the source. Never touches the source database.
# Usage: SOURCE_URL=postgres://.../db ADMIN_URL=postgres://.../postgres ./scripts/restore-check.sh <backup.dump>
set -euo pipefail
: "${SOURCE_URL:?}" "${ADMIN_URL:?}"
DUMP="${1:?path to .dump file}"
SCRATCH="automora_restore_check_$$"
psql "$ADMIN_URL" -qc "CREATE DATABASE $SCRATCH"
trap 'psql "$ADMIN_URL" -qc "DROP DATABASE IF EXISTS $SCRATCH" >/dev/null' EXIT
SCRATCH_URL="${ADMIN_URL%/*}/$SCRATCH"
pg_restore --no-owner --no-privileges --dbname="$SCRATCH_URL" "$DUMP"
COUNT_SQL="select relname || ':' || n_live_tup from pg_stat_user_tables order by 1"
counts() { psql "$1" -Atc "select format('%I', tablename) from pg_tables where schemaname='public' order by 1" | while read -r t; do echo "$t:$(psql "$1" -Atc "select count(*) from public.$t")"; done; }
diff <(counts "$SOURCE_URL") <(counts "$SCRATCH_URL") && echo "RESTORE OK: every table has the same row count as the source"
