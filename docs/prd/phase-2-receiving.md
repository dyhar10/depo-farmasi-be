# PRD Fase 2: Penerimaan Barang

> **Repositori ini: backend.** Kerjakan semua FR kecuali bagian "Layar UI" (dikerjakan di repo `depo-farmasi-frontend`). PRD ini adalah sumber utama; repo frontend menyalinnya dengan `pnpm prd:sync`.


**MVP-1** · Prasyarat: Fase 1 · Estimasi: 3 minggu

## 1. Tujuan

Mencatat barang masuk dengan nomor batch, ED, dan harga sesuai surat jalan, sehingga stok gudang dan nilai persediaan terbentuk otomatis dari dokumen penerimaan.

## 2. Ruang lingkup

**Termasuk:** dokumen penerimaan (draft, posting, batal), pembuatan/penggunaan batch, konversi satuan, peringatan harga, retur ke PBF, cetak dokumen, riwayat penerimaan.
**Tidak termasuk:** tautan ke PO yang lengkap (Fase 5; kolom `po_id` sudah ada dan opsional), alur hibah/program/pinjaman yang khusus (Fase 7; `source_type` sudah tersedia).

## 3. Pengguna

`staf_gudang` (input dan posting), `kepala_depo` (posting, batal, lihat semua).

## 4. Kebutuhan fungsional

| ID | Kebutuhan |
| --- | --- |
| FR-2.1 | Buat draf penerimaan: tanggal, lokasi penerima, supplier, nomor surat jalan, nomor faktur, jalur pesanan (manual / e-purchasing), sumber (pembelian dkk.), catatan |
| FR-2.2 | Baris penerimaan: item, **nomor batch (wajib, dari surat jalan)**, ED, jumlah + satuan input (besar/kecil), harga per satuan kecil |
| FR-2.3 | Konversi otomatis satuan besar ke satuan kecil memakai `items.pack_size`; tampilkan hasil konversi sebelum posting |
| FR-2.4 | Saat posting: batch dikenali dari (item, nomor batch); ada = gabung, tidak ada = buat batch baru dengan ED dan harga dari baris |
| FR-2.5 | Nomor batch yang sama datang dengan harga atau ED berbeda: tampilkan peringatan, minta konfirmasi dan alasan; keputusan tercatat di audit |
| FR-2.6 | Peringatan bila harga menyimpang > ambang (default 20%) dari `reference_price` atau harga batch terakhir |
| FR-2.7 | Tolak ED yang sudah lewat; peringatan bila ED < 6 bulan (ambang dapat diatur) |
| FR-2.8 | Posting lewat PostingService: mutasi `receipt` positif per batch, saldo gudang bertambah, nomor dokumen dibuat |
| FR-2.9 | Pembatalan dokumen posted: butuh alasan dan izin; membuat mutasi `reversal`; ditolak bila stok batch sudah terpakai sebagian |
| FR-2.10 | Retur ke PBF (`stock_returns`, jenis `retur_pbf`): pilih batch, jumlah, alasan; mutasi `return_out` |
| FR-2.11 | Impor penerimaan dari Excel (opsional, untuk input ulang bulan Mei saat parallel run), dengan dry-run |
| FR-2.12 | Daftar dan pencarian penerimaan (tanggal, supplier, item, nomor batch, status), cetak/ekspor PDF |
| FR-2.13 | Draf dapat disimpan dan dilanjutkan; draf lebih dari 7 hari memunculkan pengingat |

## 5. Data

Tabel: `receipts`, `receipt_lines`, `batches`, `stock_balances`, `stock_movements`, `stock_returns`, `stock_return_lines`, `document_counters`, `outbox_events`, `audit_logs`.

## 6. API

| Method | Path | Izin |
| --- | --- | --- |
| GET | `/api/v1/receipts?status=&supplier_id=&from=&to=&cursor=` | `stock.balance.read` |
| POST | `/api/v1/receipts` (draf) | `stock.receipt.write` |
| GET/PATCH | `/api/v1/receipts/:id` | `stock.receipt.write` |
| PUT | `/api/v1/receipts/:id/lines` | `stock.receipt.write` |
| POST | `/api/v1/receipts/:id/post` (`Idempotency-Key`) | `stock.receipt.post` |
| POST | `/api/v1/receipts/:id/cancel` | `stock.receipt.post` |
| GET | `/api/v1/receipts/:id/pdf` | `stock.balance.read` |
| POST | `/api/v1/stock-returns` (`retur_pbf`) lalu `/:id/post` | `stock.return.post` |
| GET | `/api/v1/batches?item_id=&expiry_before=` | `stock.balance.read` |

## 7. Layar UI

Daftar penerimaan; form penerimaan dengan tabel baris yang nyaman dipakai keyboard (Tab, Enter menambah baris, tempel dari Excel); panel peringatan (harga, ED, batch ganda); halaman retur PBF; pencarian batch.

## 8. Aturan bisnis dan validasi

- Nomor batch wajib dan dinormalisasi (trim, huruf besar) sebelum dibandingkan.
- Satu dokumen satu lokasi penerima; lokasi harus `holds_stock`.
- Jumlah > 0; harga >= 0; ED atau `no_expiry` harus diisi (kecuali impor legacy).
- Dokumen `posted` tidak dapat diubah; koreksi lewat batal + dokumen baru.
- Dua baris pada dokumen sama dengan (item, nomor batch) yang sama digabung atau ditolak dengan pesan jelas.
- `unit_cost` batch tidak berubah setelah ada mutasi; harga berbeda untuk nomor batch yang sama dicatat di baris penerimaan dan peringatan, bukan menimpa harga batch.

## 9. Non-fungsional

- Posting 100 baris selesai < 2 detik.
- 20 pengguna memposting bersamaan tanpa deadlock (urutan kunci tetap).
- Posting yang diulang (retry) tidak menggandakan stok (idempotensi).

## 10. Acceptance criteria

1. **Batch baru:** penerimaan item X batch B1 ED 2027-05 harga 320 menambah saldo gudang dan membuat batch `B1`.
2. **Batch sama:** penerimaan kedua item X batch B1 menambah saldo batch yang sama, bukan membuat batch baru.
3. **Konversi:** 42 Box x isi 100 menghasilkan 4.200 satuan kecil.
4. **Batch ganda beda harga:** B1 dengan harga berbeda memunculkan peringatan; tanpa konfirmasi, posting ditolak.
5. **ED lewat:** posting ditolak dengan pesan yang menyebut baris.
6. **Idempotensi:** posting ulang dengan `Idempotency-Key` sama tidak menambah stok.
7. **Pembatalan:** batal penerimaan yang stoknya belum terpakai menghasilkan `reversal` dan saldo kembali; bila sudah terpakai, ditolak.
8. **Kecocokan:** input ulang penerimaan satu bulan menghasilkan total qty dan total nilai yang sama dengan "Total Penerimaan" dan "Total Harga Penerimaan" di spreadsheet (selisih dijelaskan).
9. **Hak akses:** `staf_depo` tidak dapat memposting penerimaan gudang.
10. **Retur PBF:** retur mengurangi saldo batch dan tidak dapat melebihi saldo.

## 11. Pengujian

Unit (konversi, normalisasi batch, aturan peringatan), integrasi (posting paralel, idempotensi, reversal), E2E (alur input draf sampai posting), uji beban ringan posting 100 baris.

## 12. Poin terbuka

#1 dan #2 definisi batch dan toleransi harga, #7 arti kolom M/E, #14 retur dan batas peringatan ED.

## 13. Definition of Done

Lihat `00-overview.md` bagian 5, ditambah: penerimaan Mei 2026 diinput ulang di staging dan laporan kecocokan disetujui `kepala_depo`.
