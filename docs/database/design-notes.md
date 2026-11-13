# Catatan Desain Database

Skema lengkap: `schema.sql` (42 tabel, sudah diuji di PostgreSQL 16). Seed peran dan hak akses: `seed.sql`. Diagram: `erd.md`.

## 1. Prinsip

1. **Tanpa auto-increment.** Semua PK `uuid` v7. Tidak ada `serial`, `bigserial`, atau `identity`. Pengecekan otomatis (lihat bagian 8) memastikan 0 kolom seperti itu.
2. **Stok = ledger.** `stock_movements` append-only (trigger menolak UPDATE/DELETE). `stock_balances` hanya berubah di transaksi yang sama dengan insert ledger.
3. **Batch = item + nomor batch dari surat jalan.** Harga (`unit_cost`) dan ED melekat di batch. Penerimaan wajib membawa `batch_number`.
4. **Satu satuan di database: satuan kecil.** Konversi dari satuan besar dilakukan saat input (`receipt_lines.input_qty`, `input_unit_id`, `qty_base`).
5. **Uang `NUMERIC(18,4)`, qty `NUMERIC(18,3)`.** Tidak ada float.
6. **Enum = `text` + `CHECK`.** Menambah nilai cukup satu migrasi, tanpa mengunci tipe.
7. **Dokumen tidak dihapus.** Dibatalkan lewat status dan mutasi balik (`reversal`).

## 2. Mengapa UUID v7

| Pertimbangan | UUID v7 | Auto-increment |
| --- | --- | --- |
| Bisa ditebak / dienumerasi (IDOR) | Tidak | Ya |
| Urutan waktu, lokalitas indeks B-tree | Ya (48 bit timestamp di depan) | Ya |
| Dibuat tanpa roundtrip DB (di aplikasi atau di DB) | Ya | Tidak |
| Aman digabung antar lingkungan / impor | Ya | Rawan tabrakan |
| Ukuran | 16 byte | 4 / 8 byte |

UUID v4 acak dihindari karena membuat indeks terfragmentasi saat tulis. Fungsi `uuid_generate_v7()` ada di `schema.sql`; di PostgreSQL 18+ ganti dengan `uuidv7()` bawaan. Aplikasi boleh membuat ID sendiri (library `uuidv7`) agar dokumen dan barisnya bisa dirangkai sebelum insert.

**Catatan:** UUID tidak menggantikan otorisasi. Setiap query tetap memeriksa hak akses dan lokasi pengguna.

Nomor dokumen yang terbaca manusia (`RCV-2026-11-000123`) dibuat dari `document_counters` dengan kunci baris; nomor itu hanya untuk tampilan dan pencarian.

## 3. Pemetaan spreadsheet ke tabel

| Spreadsheet (sheet: kolom) | Tabel.kolom |
| --- | --- |
| Semua sheet: Kodifikasi (Huruf) Plus ... | `items.code` |
| Kategori (Obat / BMHP), Sub Kategori Format, Sub Sub Kategori Format | `item_categories` (pohon 3 level), `items.category_id`, `items.item_type` |
| Nama Obat (Generik) / (Merk) | `items.generic_name`, `items.brand_name` |
| Bentuk Sediaan, Kekuatan | `dosage_forms`, `items.strength` |
| atc, ddd | `items.atc_code`, `items.ddd` (nilai #N/A diimpor sebagai NULL) |
| Satuan Kecil, Satuan Besar, Kemasan | `items.base_unit_id`, `items.purchase_unit_id`, `items.pack_size` |
| Ekatalog / Non Ekatalog | `items.catalog_type` (normalisasi huruf besar-kecil) |
| FORMULARIUM RS / NON FORMULARIUM RS | `items.formulary_status` |
| Generik/Non Generik Fornas | `items.fornas_class` |
| Harga Per Item (baris pertama per kode) / Harga Perencanaan | `items.reference_price` |
| Harga Per Item (tiap baris kode + harga), No. Urut Harga | `batches.unit_cost`, `batches.legacy_price_seq`, `batches.is_legacy = true` |
| SAFETY STOK, MIN, STATUS SLOW / FAST / NON, catatan pembelian | `item_planning_params` |
| Nama Penyedia, Nama Distributor, Distributor | `suppliers`, `item_suppliers`, `purchase_orders.supplier_id / distributor_id` |
| STOK AWAL (Gudang, Depo Rajal, HD, IGD, Ranap, IBS, Inventaris, Troli Emergensi, Lab, Radiologi) | `locations` + `stock_balances` + 1 mutasi `opening` per baris |
| Penerimaan harian tgl 1-31 (kolom M / E) | `receipts` + `receipt_lines` (`order_channel` manual / e_purchasing; dugaan, perlu validasi) |
| Total Penerimaan, Total Harga Penerimaan | Dihitung dari ledger, tidak disimpan |
| KURNIA SARI / PINJAMAN | `receipts.source_type = 'pinjaman'` (+ `stock_loans` di Fase 7) |
| Sheet BARANG HIBAH DAN PROGRAM: Sumber | `suppliers` (type `donor`), `batches.source_type` = hibah / program |
| Pengeluaran harian per unit (Rj, Rp, IGD, OK, HD, Lab, Rad) | `issues` + `issue_lines` (`issue_type = 'pengeluaran_unit'`) |
| AMPRAHAN RUANGAN (+/- 50 ruangan) | `locations` (type ruangan), `requisitions`, `issues` (`amprahan_ruangan`) |
| RETUR APOTEK, RETUR PBF | `stock_returns` + `stock_return_lines` |
| EXP bulan berjalan | `stock_adjustments` (`expired`) |
| BTT (amprahan, pengeluaran, penerimaan) | `batches.source_type = 'btt'`, `issues.issue_type = 'pengeluaran_btt'` (definisi dikonfirmasi di Fase 7) |
| Perencanaan 3 Bulan (A) | `procurement_plans`, `procurement_plan_items.planned_qty` |
| Penerimaan April / Mei / Juni (B, C, D) | Dihitung: `v_plan_remaining.received_qty` |
| Sisa Perencanaan A - (B+C+D) | `v_plan_remaining.remaining_qty` |
| PO MANUAL / PO E-PUR per minggu W1-W5 | `purchase_orders` (`order_channel`) + `po_line_schedules` |
| No ID Paket, Tgl Pemesanan PP, Tgl Rilis PDF PPK | `purchase_orders.package_id`, `ordered_at`, `ppk_released_at` |
| Legenda warna (parsial, beli produk lain, nunggu kirim, coret/ganti, peningkatan) | `purchase_order_lines.line_status` |
| STATUS MENIPIS (AMAN / MENIPIS / MENIPIS CITO / CITO) | `v_item_stock_status.stock_status` (dihitung, tidak disimpan) |
| HUTANG LOGISTIK KE PELAYANAN | `v_requisition_outstanding` |
| SUMMARY (stok awal, pembelian, masuk, keluar, akhir) | `stock_period_summaries` |
| KETERSEDIAAN BARANG (rerata per hari, perkiraan ketersediaan) | Dihitung dari `stock_period_summaries` + `stock_balances` |
| Sheet30 (daftar ruangan) | `locations` (type ruangan) |

### Aturan impor (Fase 1, saldo awal)

- Tiap baris kode + harga di sheet PENERIMAAN menjadi satu batch `is_legacy = true` dengan `batch_number = 'LEGACY-<legacy_price_seq>'`, `expiry_date = NULL`.
- Stok awal per lokasi menjadi `stock_balances` + satu mutasi `opening` (dokumen `import`), bukan insert langsung ke saldo.
- Batch legacy diganti/dilengkapi nomor batch dan ED saat opname pertama (Fase 4), lewat penyesuaian terdokumentasi.
- Normalisasi: "Non Ekatalog" dan "Non ekatalog" menjadi `non_ekatalog`; "Obat bermerek" dan "Obat Bermerek" disatukan; `#N/A` menjadi NULL.
- Impor selalu `dry_run` dulu; hasilnya (jumlah diterima/ditolak, selisih total stok per kode vs spreadsheet) ditinjau sebelum eksekusi.

## 4. Alur posting stok (satu transaksi)

```
BEGIN
  1. Kumpulkan pasangan (location_id, batch_id) yang akan berubah, urutkan (location_id, batch_id).
  2. INSERT ... ON CONFLICT DO NOTHING untuk baris stock_balances yang belum ada.
  3. SELECT ... FROM stock_balances WHERE (location_id, batch_id) IN (...) ORDER BY location_id, batch_id FOR UPDATE.
     (urutan konsisten mencegah deadlock antar transaksi)
  4. Validasi: saldo cukup untuk mutasi negatif; ED belum lewat untuk penerimaan; status dokumen = draft.
  5. INSERT stock_movements (satu baris per mutasi, unit_cost = snapshot harga batch).
  6. UPDATE stock_balances SET quantity = quantity + delta, row_version = row_version + 1.
  7. UPDATE dokumen SET status = 'posted', posted_at, posted_by.
  8. INSERT outbox_events (untuk invalidasi cache dan alert).
  9. INSERT audit_logs.
COMMIT
```

`CHECK (quantity >= 0)` di `stock_balances` adalah jaring pengaman terakhir; pelanggarannya membatalkan seluruh transaksi.
Pembatalan dokumen posted = mutasi `reversal` baru yang menunjuk `reversal_of_id`, bukan hapus.
Posting diulang dengan header `Idempotency-Key` yang sama mengembalikan respons tersimpan dari `idempotency_keys`.

## 5. Skalabilitas

| Area | Keputusan |
| --- | --- |
| Pertumbuhan ledger | `stock_movements` dan `audit_logs` dipartisi bulanan (UTC). Partisi lama bisa di-`DETACH` dan diarsipkan tanpa `DELETE` besar. Fungsi `ensure_future_partitions()` dijalankan worker tiap bulan; partisi `_default` menangkap data nyasar |
| Baca saldo | Dari `stock_balances` (kecil, 1 baris per lokasi x batch), bukan menjumlahkan ledger |
| Laporan | `stock_period_summaries` diisi worker; laporan bulanan tidak memindai ledger. Dashboard berat memakai materialized view atau cache 30-60 detik |
| Indeks | Tiap FK yang sering di-join punya indeks; indeks parsial untuk draft/pending dan saldo > 0; trigram untuk pencarian nama/kode; BRIN untuk `occurred_at` |
| Pagination | Keyset (`WHERE (date, id) < (:d, :id) ORDER BY date DESC, id DESC LIMIT n`), bukan `OFFSET`. UUID v7 membuat `id` ikut berurutan waktu |
| Konkurensi | Kunci baris `stock_balances` dalam urutan tetap; transaksi pendek; tanpa kunci tabel |
| Koneksi | Aplikasi lewat PgBouncer (transaction pooling). Hindari fitur sesi (prepared statement bernama, advisory lock sesi) |
| Replika baca | Laporan dan dashboard dapat diarahkan ke replika; transaksi tulis dan baca-lalu-tulis tetap ke primary |
| Skala horizontal aplikasi | API stateless, sesi di JWT + refresh token di DB, cache bersama di Redis, job di antrean; dapat menambah replika API/worker tanpa perubahan kode |
| Jalur tumbuh | Bila satu depo menjadi banyak depo/RS: tambah kolom `facility_id` pada tabel transaksi dan partisi hash lokasi pada `stock_balances` / `stock_movements` (sub-partisi). Diputuskan hanya jika ada kebutuhan nyata |
| Retensi | Ledger dan audit disimpan sesuai kebijakan RS (usulan >= 5 tahun); partisi lebih tua diarsipkan ke penyimpanan dingin (pg_dump per partisi) |

**Perkiraan volume (asumsi kasar, perlu diverifikasi dari data opname):** sheet PENERIMAAN berisi 2.359 baris kode + harga dan sheet transaksi harian memakai kolom per hari dan per unit. Dengan skala satu depo, ledger diperkirakan puluhan ribu baris per bulan, jauh di bawah batas yang menyulitkan PostgreSQL. Partisi dipilih untuk manajemen siklus hidup dan jalur tumbuh, bukan karena beban saat ini.

## 6. Keamanan di level database

- Tiga peran DB: `app_migrator` (DDL), `app_rw` (DML, dipakai API/worker), `app_ro` (laporan/replika). Aplikasi tidak memakai superuser.
- Password pengguna: argon2id di `users.password_hash`; refresh token disimpan sebagai hash.
- Otorisasi per lokasi diterapkan di aplikasi (guard + filter `location_id`). Row-Level Security PostgreSQL boleh ditambahkan bila ada kebutuhan audit yang lebih ketat.
- Backup: base backup harian + arsip WAL (PITR); uji pemulihan tiap kuartal.
- Kolom sensitif tidak ada (tanpa data pasien). Bila kelak ada integrasi resep/SIMRS, tinjau ulang (UU PDP).

## 7. Konvensi

- Nama tabel `snake_case` jamak; PK selalu `id`; FK `<entitas>_id`; waktu `timestamptz`; tanggal murni `date`.
- Kolom standar pada tabel master: `created_at`, `updated_at` (trigger otomatis), `deleted_at` (soft delete), `created_by` / `updated_by` bila relevan.
- Migrasi: alat migrasi (`node-pg-migrate`, ADR 0005) menjadi sumber kebenaran; `schema.sql` adalah baseline referensi. Perubahan berisiko memakai pola expand, migrate, contract (lihat `.agents/rules/`).
- Tidak ada logika bisnis di trigger kecuali pengaman integritas (append-only, `updated_at`).

## 8. Pemeriksaan otomatis (dijalankan di CI)

```sql
-- harus 0: tidak ada kolom sequence / identity
SELECT count(*) FROM information_schema.columns
WHERE table_schema = 'public' AND (column_default LIKE 'nextval%' OR is_identity = 'YES');

-- Tabel yang PK-nya memuat kolom non-uuid. Hasil HARUS persis daftar ini (semuanya komposit atau kunci alami, tanpa sequence):
-- audit_logs, stock_movements (id uuid + occurred_at partisi), document_counters, idempotency_keys,
-- permissions, role_permissions, stock_period_summaries
SELECT DISTINCT c.relname
FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (k.conkey)
WHERE k.contype = 'p' AND c.relnamespace = 'public'::regnamespace
  AND c.relkind IN ('r','p') AND NOT c.relispartition AND a.atttypid <> 'uuid'::regtype
ORDER BY 1;
```
