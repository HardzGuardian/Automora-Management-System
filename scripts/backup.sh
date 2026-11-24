#!/usr/bin/env bash
# Logical backup of the application database: custom-format dump, verified, optionally encrypted,
# optionally copied off-site, with old backups pruned.
#
# Usage:  DATABASE_URL=postgres://... ./scripts/backup.sh [output-dir]
#
# Optional environment:
#   BACKUP_PASSPHRASE     encrypt the dump with AES-256 (openssl, PBKDF2). Output gets a .enc suffix.
#   BACKUP_RETENTION_DAYS delete local backups older than this many days (default 14; 0 keeps everything)
#   BACKUP_S3_URI         copy the finished file to this location, e.g. s3://my-bucket/automora/
#                         (needs the AWS CLI; set BACKUP_S3_ENDPOINT for MinIO / other S3-compatible stores)
#   BACKUP_PING_URL       GET this URL after a successful run (healthchecks.io style "it ran" monitor)
#   BACKUP_PING_FAIL_URL  GET this URL if the run fails
#
# Schedule it (see deploy/scheduler/crontab or any cron): at least daily. Restore: scripts/restore-check.sh
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
OUT_DIR="${1:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR" 2>/dev/null || true

ping() { [ -n "${1:-}" ] && command -v curl >/dev/null 2>&1 && curl -fsS -m 10 --retry 3 -o /dev/null "$1" || true; }
trap 'rc=$?; if [ $rc -ne 0 ]; then echo "backup FAILED (exit $rc)" >&2; ping "${BACKUP_PING_FAIL_URL:-}"; fi' EXIT

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="$OUT_DIR/automora-$STAMP.dump"
pg_dump --format=custom --no-owner --no-privileges --file="$DUMP" "$DATABASE_URL"
pg_restore --list "$DUMP" > /dev/null   # fail now if the archive is unreadable

FINAL="$DUMP"
if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  FINAL="$DUMP.enc"
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -in "$DUMP" -out "$FINAL"
  # prove the encrypted copy decrypts to a readable archive before the plain dump is removed
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$FINAL" | pg_restore --list > /dev/null
  rm -f "$DUMP"
fi

( cd "$OUT_DIR" && sha256sum "$(basename "$FINAL")" > "$(basename "$FINAL").sha256" )
echo "backup written: $FINAL ($(wc -c < "$FINAL") bytes)"

if [ -n "${BACKUP_S3_URI:-}" ]; then
  command -v aws >/dev/null 2>&1 || { echo "BACKUP_S3_URI is set but the AWS CLI is not installed" >&2; exit 1; }
  ENDPOINT_ARGS=()
  [ -n "${BACKUP_S3_ENDPOINT:-}" ] && ENDPOINT_ARGS=(--endpoint-url "$BACKUP_S3_ENDPOINT")
  aws "${ENDPOINT_ARGS[@]}" s3 cp "$FINAL" "${BACKUP_S3_URI%/}/" --only-show-errors
  aws "${ENDPOINT_ARGS[@]}" s3 cp "$FINAL.sha256" "${BACKUP_S3_URI%/}/" --only-show-errors
  echo "copied off-site: ${BACKUP_S3_URI%/}/$(basename "$FINAL")"
fi

if [ "$RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
  find "$OUT_DIR" -maxdepth 1 -type f \( -name 'automora-*.dump' -o -name 'automora-*.dump.enc' -o -name 'automora-*.sha256' \) -mtime "+$RETENTION_DAYS" -print -delete | sed 's/^/pruned: /'
fi

ping "${BACKUP_PING_URL:-}"
