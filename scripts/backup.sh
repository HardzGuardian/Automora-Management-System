#!/usr/bin/env bash
# Logical backup of the application database (custom format, compressed).
# Usage: DATABASE_URL=postgres://... ./scripts/backup.sh [output-dir]
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/automora-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-privileges --file="$FILE" "$DATABASE_URL"
pg_restore --list "$FILE" > /dev/null   # fail now if the archive is unreadable
echo "backup written: $FILE ($(wc -c < "$FILE") bytes)"
