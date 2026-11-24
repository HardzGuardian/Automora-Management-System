#!/usr/bin/env bash
# Restore drill (AC-14): restores a backup into a throwaway database and compares row counts
# of every table with the source. Never touches the source database.
# Accepts plain .dump files and encrypted .dump.enc files (set BACKUP_PASSPHRASE).
# Usage: SOURCE_URL=postgres://.../db ADMIN_URL=postgres://.../postgres ./scripts/restore-check.sh <backup.dump[.enc]>
set -euo pipefail
: "${SOURCE_URL:?}" "${ADMIN_URL:?}"
DUMP="${1:?path to .dump or .dump.enc file}"
SCRATCH="automora_restore_check_$$"
WORK="$(mktemp -d)"
cleanup() { psql "$ADMIN_URL" -qc "DROP DATABASE IF EXISTS $SCRATCH" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

if [ -f "$DUMP.sha256" ]; then ( cd "$(dirname "$DUMP")" && sha256sum -c "$(basename "$DUMP").sha256" ); fi
case "$DUMP" in
  *.enc)
    : "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required for an encrypted backup}"
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$DUMP" -out "$WORK/restore.dump"
    DUMP="$WORK/restore.dump" ;;
esac

psql "$ADMIN_URL" -qc "CREATE DATABASE $SCRATCH"
SCRATCH_URL="${ADMIN_URL%/*}/$SCRATCH"
pg_restore --no-owner --no-privileges --dbname="$SCRATCH_URL" "$DUMP"
counts() { psql "$1" -Atc "select format('%I', tablename) from pg_tables where schemaname='public' order by 1" | while read -r t; do echo "$t:$(psql "$1" -Atc "select count(*) from public.$t")"; done; }
diff <(counts "$SOURCE_URL") <(counts "$SCRATCH_URL") && echo "RESTORE OK: every table has the same row count as the source"
