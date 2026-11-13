---
name: add-migration
description: "Gunakan saat mengubah skema database: membuat migrasi SQL, pola expand-migrate-contract, indeks, dan memperbarui dokumentasi database."
---
# Menambah migrasi database

**Kapan:** setiap perubahan skema.

1. Tentukan jenis perubahan. Aditif (tabel/kolom nullable/indeks) = satu migrasi. Berisiko (rename, ubah tipe, NOT NULL, hapus) = **expand -> migrate -> contract** lintas rilis.
2. Buat migrasi lewat alat migrasi proyek. PK baru: `id uuid PRIMARY KEY DEFAULT uuid_generate_v7()`. **Tanpa** `serial`/`identity`.
3. Enum = `text` + `CHECK`. Uang `NUMERIC(18,4)`, qty `NUMERIC(18,3)`.
4. Tambahkan indeks untuk FK dan filter utama; indeks besar dengan `CREATE INDEX CONCURRENTLY`.
5. Pola expand untuk rename kolom:

```sql
-- migrasi 1 (expand)
ALTER TABLE items ADD COLUMN generic_name_v2 text;
-- aplikasi menulis ke generic_name dan generic_name_v2

-- migrasi 2 (migrate, batch kecil)
UPDATE items SET generic_name_v2 = generic_name WHERE generic_name_v2 IS NULL AND id > :last LIMIT 1000;

-- migrasi 3 (contract, rilis berikutnya)
ALTER TABLE items DROP COLUMN generic_name;
```

6. Jalankan: dari DB kosong, lalu dari snapshot fase sebelumnya. Jalankan pemeriksaan "tanpa sequence" (design-notes bagian 8).
7. Perbarui `docs/database/schema.sql`, `erd.md`, dan `design-notes.md` bila entitas berubah.

**Selesai bila:** migrasi idempoten pada lingkungan baru, tidak mengunci tabel besar lama, dan dokumentasi sinkron.
