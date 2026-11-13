#!/usr/bin/env bash
# Backup logis sebelum rilis: ./backup.sh <label>. Backup harian + arsip WAL (PITR) dikelola terpisah di server DB.
set -euo pipefail
LABEL="${1:?pemakaian: backup.sh <label>}"
cd "$(dirname "$0")"
set -a; . ./.env; set +a
mkdir -p backups
FILE="backups/${LABEL}-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner "$DATABASE_URL" --file "$FILE"
echo "backup tersimpan: $FILE"
# Simpan 14 backup terakhir
ls -1t backups/*.dump | tail -n +15 | xargs -r rm --
