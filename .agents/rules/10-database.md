---
trigger: model_decision
description: Aturan database untuk migrasi SQL, skema, query, konkurensi stok, partisi, dan repository (db/, docs/database/, src/modules/*/repositories).
---
# Aturan database

## 1. Database

### 1.1 Skema dan tipe
- PK `id uuid DEFAULT uuid_generate_v7()` (PG 18+: `uuidv7()`). Aplikasi boleh membuat ID sendiri dengan library `uuidv7`. Tabel kunci alami (`permissions`, `document_counters`, ...) dan PK komposit di tabel saldo/ringkasan dikecualikan, tetap tanpa sequence.
- Uang `NUMERIC(18,4)`; qty `NUMERIC(18,3)`; waktu `timestamptz`; tanggal murni `date`; teks bebas `text`.
- Enum = `text` + `CHECK`, bukan tipe ENUM native.
- Nama: tabel `snake_case` jamak; FK `<entitas>_id`; indeks `ix_<tabel>_<kolom>`; unik `ux_...`.
- Tabel master punya `created_at`, `updated_at`, dan `deleted_at` (soft delete) bila relevan. Dokumen transaksi tidak dihapus; pakai `status`.
- Tidak ada logika bisnis di trigger. Pengecualian: `set_updated_at`, `forbid_mutation` (append-only).

### 1.2 Migrasi
- Alat migrasi: `node-pg-migrate` dengan berkas SQL di `db/migrations/` (keputusan di ADR 0005) adalah sumber kebenaran. `docs/database/schema.sql` adalah baseline referensi dan harus tetap sinkron.
- Satu migrasi = satu perubahan logis, dapat dijalankan di atas data nyata. Migrasi yang sudah dirilis **tidak diedit**; buat migrasi baru.
- Pola **expand -> migrate -> contract** untuk perubahan berisiko (ganti nama kolom, ubah tipe, tambah NOT NULL):
  1. Expand: tambah kolom/tabel baru (nullable atau dengan default), aplikasi menulis ke keduanya.
  2. Migrate: isi ulang data (batch kecil, di luar transaksi panjang).
  3. Contract: setelah semua versi aplikasi memakai yang baru, hapus yang lama di rilis berikutnya.
- Tambah indeks besar dengan `CREATE INDEX CONCURRENTLY` (di luar transaksi migrasi).
- Setiap migrasi menyertakan uji: migrasi dari nol dan dari snapshot fase sebelumnya.
- CI menjalankan pemeriksaan di `docs/database/design-notes.md` bagian 8 (tidak ada sequence/identity).

### 1.3 Query
- **Keyset pagination** (`WHERE (tanggal, id) < (:t, :id) ORDER BY tanggal DESC, id DESC LIMIT n`). **JANGAN** `OFFSET` pada tabel transaksi.
- Semua query list punya batas (`LIMIT`) dan indeks pendukung; cek `EXPLAIN` untuk query baru di tabel transaksi.
- **JANGAN** `SELECT *` di kode aplikasi; sebut kolomnya.
- Query agregat berat membaca `stock_balances` / `stock_period_summaries`, bukan memindai `stock_movements`.
- Kueri stok dan posting memakai SQL eksplisit atau query builder; ORM boleh untuk CRUD master.
- Transaksi pendek: tidak ada panggilan jaringan atau pekerjaan berat di dalam transaksi.

### 1.4 Konkurensi
- Kunci baris `stock_balances` dengan `SELECT ... FOR UPDATE` **berurutan (`location_id`, `batch_id`)** untuk mencegah deadlock.
- `CHECK (quantity >= 0)` adalah jaring pengaman; validasi saldo tetap dilakukan di aplikasi dengan pesan yang jelas.
- Operasi POST yang mengubah stok mendukung `Idempotency-Key`.

### 1.5 Partisi dan retensi
- `stock_movements` dan `audit_logs` dipartisi bulanan; `ensure_future_partitions()` dijalankan worker tiap bulan. Partisi lama diarsipkan lewat `DETACH`, bukan `DELETE`.
- FK dari/ke tabel berpartisi dihindari; relasi ke ledger lewat `document_type` + `document_id` yang divalidasi di aplikasi.
