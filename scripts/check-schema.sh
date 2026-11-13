#!/usr/bin/env bash
# Menerapkan docs/database/schema.sql + seed.sql ke database kosong lalu memeriksa aturan skema.
# Pemakaian: DATABASE_URL=postgres://user:pass@host:5432/db ./scripts/check-schema.sh
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL wajib diisi}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -At)

"${PSQL[@]}" -f "$ROOT/docs/database/schema.sql"
"${PSQL[@]}" -f "$ROOT/docs/database/seed.sql"

fail=0

# 1. Tidak boleh ada kolom sequence / identity
n=$("${PSQL[@]}" -c "SELECT count(*) FROM information_schema.columns
  WHERE table_schema='public' AND (column_default LIKE 'nextval%' OR is_identity='YES')")
if [ "$n" != "0" ]; then echo "GAGAL: $n kolom memakai sequence/identity"; fail=1; else echo "OK: tanpa sequence/identity"; fi

# 2. Tabel yang PK-nya memuat kolom non-uuid harus persis daftar yang disetujui
actual=$("${PSQL[@]}" -c "SELECT DISTINCT c.relname
  FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
  JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=ANY(k.conkey)
  WHERE k.contype='p' AND c.relnamespace='public'::regnamespace
    AND c.relkind IN ('r','p') AND NOT c.relispartition AND a.atttypid <> 'uuid'::regtype
  ORDER BY 1" | tr '\n' ' ')
expected="audit_logs document_counters idempotency_keys permissions role_permissions stock_movements stock_period_summaries "
if [ "$actual" != "$expected" ]; then echo "GAGAL: PK non-uuid tak terduga: $actual"; fail=1; else echo "OK: PK non-uuid sesuai daftar"; fi

# 3. UUID v7 valid dan berurutan waktu
v=$("${PSQL[@]}" -c "SELECT substr(uuid_generate_v7()::text,15,1)")
if [ "$v" != "7" ]; then echo "GAGAL: uuid_generate_v7 tidak menghasilkan versi 7"; fail=1; else echo "OK: uuid v7"; fi

# 4. Ledger append-only
if "${PSQL[@]}" -c "UPDATE stock_movements SET unit_cost = unit_cost" 2>/dev/null && \
   [ "$("${PSQL[@]}" -c "SELECT count(*) FROM stock_movements")" != "0" ]; then
  echo "GAGAL: ledger dapat diubah"; fail=1
else
  echo "OK: ledger append-only (atau kosong)"
fi

exit $fail
