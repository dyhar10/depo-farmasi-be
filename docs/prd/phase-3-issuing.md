# PRD Fase 3: Pengeluaran, Distribusi, dan Amprahan

> **Repositori ini: backend.** Kerjakan semua FR kecuali bagian "Layar UI" (dikerjakan di repo `depo-farmasi-frontend`). PRD ini adalah sumber utama; repo frontend menyalinnya dengan `pnpm prd:sync`.


**MVP-1** · Prasyarat: Fase 2 · Estimasi: 4 minggu

## 1. Tujuan

Mencatat seluruh pergerakan keluar: permintaan dari depo/ruangan, mutasi gudang ke depo, pengeluaran ke unit/ruangan, retur apotek, dan barang expired, dengan pemilihan batch otomatis (FEFO) dan saldo yang selalu benar.

## 2. Ruang lingkup

**Termasuk:** permintaan/amprahan, dokumen pengeluaran dan mutasi, FEFO, retur apotek, pencatatan expired, laporan rekonsiliasi parallel run, stok per depo.
**Tidak termasuk:** opname dan penyesuaian (Fase 4), pengeluaran BTT khusus (Fase 7).

## 3. Pengguna

`staf_gudang` (mutasi ke depo, pengeluaran), `staf_depo` (permintaan, pengeluaran ke ruangan, retur), `peminta_ruangan` (buat permintaan), `kepala_depo` (setujui permintaan, expired).

## 4. Kebutuhan fungsional

| ID | Kebutuhan |
| --- | --- |
| FR-3.1 | Permintaan (`requisitions`): ruangan/depo peminta, pemberi (gudang/depo), baris item dan jumlah; status draft, submitted, approved, partially_fulfilled, fulfilled, rejected, cancelled |
| FR-3.2 | Persetujuan permintaan (jumlah disetujui boleh lebih kecil dari diminta) |
| FR-3.3 | Dokumen pengeluaran (`issues`): jenis `mutasi_depo`, `amprahan_ruangan`, `pengeluaran_unit`; dari lokasi, ke lokasi, tanggal, tautan ke permintaan (opsional) |
| FR-3.4 | **Alokasi FEFO otomatis:** sistem memilih batch dengan ED terdekat yang masih punya saldo di lokasi asal; satu item dapat menjadi beberapa baris batch; pengguna dapat mengganti batch dengan alasan |
| FR-3.5 | Mutasi antar lokasi memposting dua sisi dalam satu transaksi: `transfer_out` di asal dan `transfer_in` di tujuan bila tujuan `holds_stock`; bila tujuan hanya ruangan tanpa stok, hanya `issue` |
| FR-3.6 | Posting menolak jumlah melebihi saldo batch; pesan menyebut item, batch, dan saldo tersedia |
| FR-3.7 | Pemenuhan sebagian: `fulfilled_qty` pada baris permintaan bertambah; sisa terlihat sebagai "utang logistik ke pelayanan" (`v_requisition_outstanding`) |
| FR-3.8 | Pengeluaran harian per unit (Rj, Rp, IGD, OK, HD, Lab, Rad) dapat diinput massal (tabel) atau diimpor dari Excel |
| FR-3.9 | Retur apotek (`stock_returns`, `retur_apotek`): dari depo/ruangan kembali ke gudang atau depo; mutasi `return_out` dan `return_in` |
| FR-3.10 | Barang expired: dokumen penyesuaian jenis `expired` yang memerlukan persetujuan `kepala_depo`; mutasi `expired` |
| FR-3.11 | Pembatalan dokumen posted lewat mutasi `reversal` (hanya bila memungkinkan, dengan alasan) |
| FR-3.12 | Stok per depo: daftar stok per lokasi, filter kategori dan status, ekspor Excel |
| FR-3.13 | Laporan rekonsiliasi parallel run: stok akhir sistem vs stok akhir spreadsheet per kode, selisih disorot |
| FR-3.14 | Daftar dan pencarian dokumen pengeluaran, cetak bukti pengeluaran (PDF) |

## 5. Data

Tabel: `requisitions`, `requisition_lines`, `issues`, `issue_lines`, `stock_returns`, `stock_return_lines`, `stock_adjustments`, `stock_adjustment_lines` (jenis expired), `stock_balances`, `stock_movements`. View: `v_requisition_outstanding`.

## 6. API

| Method | Path | Izin |
| --- | --- | --- |
| GET/POST | `/api/v1/requisitions` | `stock.requisition.create` |
| POST | `/api/v1/requisitions/:id/submit`, `/approve`, `/reject` | buat / `stock.requisition.approve` |
| GET/POST | `/api/v1/issues` (draf) | `stock.issue.write` |
| POST | `/api/v1/issues/:id/allocate` (hitung FEFO) | `stock.issue.write` |
| POST | `/api/v1/issues/:id/post` (`Idempotency-Key`) | `stock.issue.post` |
| POST | `/api/v1/issues/:id/cancel` | `stock.issue.post` |
| POST | `/api/v1/issues/bulk-import` (Excel pengeluaran harian) | `stock.issue.write` |
| POST | `/api/v1/stock-returns` (`retur_apotek`) lalu `/:id/post` | `stock.return.post` |
| POST | `/api/v1/stock-adjustments` (`expired`) lalu `/submit`, `/approve` | `stock.adjustment.request` / `.approve` |
| GET | `/api/v1/outstanding-requisitions` | `stock.balance.read` |
| GET | `/api/v1/reports/reconciliation?month=` | `report.read` |

## 7. Layar UI

Daftar permintaan dan form permintaan; antrean persetujuan; form pengeluaran dengan hasil alokasi FEFO yang dapat diubah; input massal pengeluaran harian per unit; retur apotek; pencatatan expired; stok per depo; laporan rekonsiliasi.

## 8. Aturan bisnis dan validasi

- FEFO: urut ED naik, lalu waktu penerimaan; **batch legacy tanpa ED dialokasikan lebih dulu** (asumsi stok lama; poin validasi #14).
- Saldo tidak pernah negatif; tidak ada pengeluaran dari lokasi yang `holds_stock = false`.
- Lokasi asal dan tujuan harus berbeda.
- Staf depo hanya dapat mengeluarkan dari lokasinya sendiri.
- Persetujuan permintaan tidak mengubah stok; stok berubah hanya saat posting pengeluaran.
- Expired hanya untuk batch yang ED-nya sudah lewat atau akan lewat bulan ini, kecuali dengan alasan khusus.

## 9. Non-fungsional

- Alokasi FEFO untuk 100 baris < 1 detik.
- Posting dua sisi (transfer) atomik; kegagalan salah satu sisi membatalkan semuanya.
- Input massal 500 baris pengeluaran < 10 detik.

## 10. Acceptance criteria

1. **FEFO:** item punya batch ED 2026-12 (100) dan 2027-03 (200); pengeluaran 150 mengambil 100 dari batch pertama dan 50 dari kedua.
2. **Saldo tidak cukup:** pengeluaran melebihi saldo ditolak; tidak ada mutasi tersimpan.
3. **Transfer:** mutasi gudang ke depo IGD mengurangi saldo gudang dan menambah saldo depo IGD pada transaksi yang sama.
4. **Parsial:** permintaan 100, pengeluaran 60, maka status `partially_fulfilled` dan "utang logistik" 40.
5. **Retur apotek:** menambah saldo gudang pada batch yang sama dan tidak melebihi jumlah yang pernah dikeluarkan.
6. **Expired:** hanya dapat diposting setelah disetujui `kepala_depo`; mengurangi saldo batch.
7. **Kecocokan:** setelah transaksi Mei diinput ulang, stok akhir per kode sama dengan kolom "Stok Akhir" di SUMMARY; selisih tercantum dan dapat ditelusuri ke ledger.
8. **Lokasi:** `staf_depo` Rajal tidak dapat memposting pengeluaran dari depo IGD.
9. **Idempotensi:** posting ulang tidak menggandakan pengeluaran.
10. **Konkurensi:** dua pengeluaran paralel untuk batch yang sama tidak membuat saldo negatif.

## 11. Pengujian

Unit (algoritma FEFO, aturan lokasi), integrasi (konkurensi 2 dan 20 posting paralel, transfer atomik, reversal), E2E (permintaan, persetujuan, pengeluaran, retur), laporan rekonsiliasi diuji pada fixture.

## 12. Poin terbuka

#12 lokasi stok vs tujuan pengeluaran, #13 satuan, #14 retur dan expired (siapa menyetujui, apakah mengubah nilai), #11 definisi hutang logistik.

## 13. Definition of Done

Lihat `00-overview.md` bagian 5, ditambah: parallel run satu bulan dijalankan di staging dan selisih rekonsiliasi dibahas bersama `kepala_depo`.
