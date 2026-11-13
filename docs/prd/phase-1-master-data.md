# PRD Fase 1: Master Data, Impor, dan Saldo Awal

> **Repositori ini: backend.** Kerjakan semua FR kecuali bagian "Layar UI" (dikerjakan di repo `depo-farmasi-frontend`). PRD ini adalah sumber utama; repo frontend menyalinnya dengan `pnpm prd:sync`.


**MVP-1** · Prasyarat: Fase 0 · Estimasi: 3 minggu

## 1. Tujuan

Memuat seluruh kodifikasi obat/BMHP, lokasi, supplier, dan saldo awal dari spreadsheet ke sistem dengan benar, serta menyediakan pencarian dan tampilan stok yang cepat. Fase ini juga membangun **PostingService**, satu-satunya jalur yang mengubah stok.

## 2. Ruang lingkup

**Termasuk:** CRUD master (item, kategori, satuan, bentuk sediaan, supplier, lokasi, parameter perencanaan), impor Excel dengan dry-run, saldo awal, tampilan stok per item x lokasi x batch, cache master, PostingService (mutasi `opening`).
**Tidak termasuk:** penerimaan, pengeluaran (Fase 2-3).

## 3. Pengguna

`admin` dan `kepala_depo` (ubah master, impor); semua peran dapat melihat master dan stok sesuai lokasi.

## 4. Kebutuhan fungsional

| ID | Kebutuhan |
| --- | --- |
| FR-1.1 | CRUD item dengan kodifikasi unik (disimpan apa adanya), kategori berjenjang, satuan kecil/besar, isi kemasan, status e-katalog, formularium, Fornas, ATC/DDD |
| FR-1.2 | Pohon kategori (`item_categories`): akar Obat/BMHP, sub, sub-sub. Daftar pilihan bentuk sediaan dan satuan bukan teks bebas |
| FR-1.3 | CRUD supplier (jenis penyedia / distributor / donor) dan relasi default per item (`item_suppliers`) |
| FR-1.4 | CRUD lokasi (gudang, depo, ruangan, inventaris, troli emergensi, lab, radiologi) dengan hierarki dan penanda `holds_stock` |
| FR-1.5 | Parameter perencanaan per item: safety stock, minimum, kelas moving (manual dulu), catatan pembelian. Validasi minimum >= safety |
| FR-1.6 | Impor Excel untuk item, supplier, lokasi, dan saldo awal; **dry-run wajib** sebelum eksekusi; laporan baris ditolak beserta alasannya |
| FR-1.7 | Normalisasi saat impor: huruf besar-kecil seragam ("Non Ekatalog"), `#N/A` jadi NULL, spasi dipangkas, kode duplikat ditolak |
| FR-1.8 | Saldo awal: tiap baris kode + harga menjadi batch `is_legacy` (`LEGACY-<urut harga>`), stok per lokasi menjadi mutasi `opening` lewat PostingService |
| FR-1.9 | Rekonsiliasi impor: total stok awal per kode sistem vs spreadsheet; selisih ditampilkan sebelum eksekusi |
| FR-1.10 | Pencarian item cepat (kode, nama generik/merk, kekuatan) dengan trigram; filter kategori, jenis, status aktif |
| FR-1.11 | Tampilan stok: per item, rincian per lokasi dan batch (qty, harga, ED), nilai persediaan |
| FR-1.12 | Cache data statis (item, kategori, supplier, lokasi, hak akses) dengan invalidasi lewat outbox |
| FR-1.13 | Nonaktifkan item (bukan hapus); item yang punya stok tidak dapat dinonaktifkan |
| FR-1.14 | PostingService: kunci baris saldo berurutan, validasi, insert ledger, update saldo, outbox, audit dalam satu transaksi |

## 5. Data

Tabel: `units`, `dosage_forms`, `item_categories`, `items`, `item_planning_params`, `suppliers`, `item_suppliers`, `locations`, `batches`, `stock_balances`, `stock_movements`, `import_jobs`, `import_job_errors`.

## 6. API

| Method | Path | Izin |
| --- | --- | --- |
| GET | `/api/v1/items?q=&category_id=&type=&cursor=` | `master.item.read` |
| POST/PATCH | `/api/v1/items`, `/api/v1/items/:id` | `master.item.write` |
| GET/POST/PATCH | `/api/v1/item-categories`, `/units`, `/dosage-forms` | baca: login; tulis: `master.item.write` |
| GET/POST/PATCH | `/api/v1/suppliers` | tulis: `master.supplier.write` |
| GET/POST/PATCH | `/api/v1/locations` | tulis: `master.location.write` |
| PUT | `/api/v1/items/:id/planning-params` | `master.item.write` |
| GET | `/api/v1/stock?item_id=&location_id=` | `stock.balance.read` |
| GET | `/api/v1/items/:id/stock` (rincian lokasi x batch) | `stock.balance.read` |
| POST | `/api/v1/imports` (unggah, `type`, `dry_run`) | `import.run` |
| GET | `/api/v1/imports/:id` (status, ringkasan, error) | `import.run` |
| POST | `/api/v1/imports/:id/execute` | `import.run` |

## 7. Layar UI

Daftar item (pencarian, filter, tabel keyset), form item, pohon kategori, daftar supplier, daftar lokasi, wizard impor (unggah, dry-run, tinjau selisih, eksekusi), halaman stok per item.

## 8. Aturan dan validasi

- `items.code` unik dan tidak pernah diubah setelah ada transaksi.
- `base_unit_id` wajib; `pack_size > 0`.
- Impor idempoten: file yang sama (`file_sha256`) tidak dieksekusi dua kali tanpa konfirmasi.
- Saldo awal hanya boleh diimpor sekali per lokasi (setelahnya lewat opname/penyesuaian).
- Item `is_active = false` tidak muncul di pilihan transaksi, tetap muncul di laporan.

## 9. Non-fungsional

- Pencarian dan daftar item p95 < 1 detik pada 1.400 kode; cache hit < 100 ms.
- Impor 2.400 baris selesai < 60 detik.
- Invalidasi cache terlihat di API <= 5 detik setelah perubahan.

## 10. Acceptance criteria

1. **Impor item:** diberi sheet dengan 1.374 kode unik, saat dry-run, maka laporan menunjukkan jumlah diterima/ditolak dan alasan per baris; eksekusi membuat semua item valid.
2. **Rekonsiliasi:** total stok awal per kode sama dengan kolom "Total Stok Awal" spreadsheet; selisih (bila ada) tertulis per kode.
3. **Batch legacy:** kode dengan 3 varian harga menghasilkan 3 batch `LEGACY-1..3` dengan harga masing-masing dan `is_legacy = true`.
4. **Duplikat:** kode yang sudah ada ditolak dengan pesan jelas.
5. **Ledger:** setiap saldo awal punya satu mutasi `opening`; menjumlahkan ledger = saldo.
6. **Normalisasi:** "Non ekatalog" dan "Non Ekatalog" menjadi satu nilai; `#N/A` pada ATC menjadi kosong.
7. **Hak akses:** `staf_gudang` tidak dapat mengubah item (403).
8. **Cache:** setelah item diubah, GET berikutnya menampilkan nilai baru <= 5 detik.
9. **Nonaktif:** item dengan stok > 0 tidak dapat dinonaktifkan.

## 11. Pengujian

Unit (normalisasi, konversi satuan), integrasi (impor penuh pada fixture 200 baris, PostingService dengan 50 posting paralel), kontrak API, E2E wizard impor. Fixture berasal dari sampel spreadsheet yang dianonimkan.

## 12. Poin terbuka (rujuk daftar validasi PRD utama)

#1 definisi batch untuk data lama, #3 metode nilai persediaan, #6 arti kode berakhiran "-B", #12 lokasi stok vs tujuan, #13 satuan dan konversi, #16 kebersihan master, #17 sheet tersembunyi.

## 13. Definition of Done

Lihat `00-overview.md` bagian 5, ditambah: impor dry-run dan eksekusi dijalankan di staging dengan file Mei 2026 dan laporan rekonsiliasi disetujui `kepala_depo`.
