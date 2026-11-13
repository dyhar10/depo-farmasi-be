# PRD Fase 4: Opname, Penyesuaian, dan Go-Live

> **Repositori ini: backend.** Kerjakan semua FR kecuali bagian "Layar UI" (dikerjakan di repo `depo-farmasi-frontend`). PRD ini adalah sumber utama; repo frontend menyalinnya dengan `pnpm prd:sync`.


**MVP-1** · Prasyarat: Fase 3 · Estimasi: 2 minggu

## 1. Tujuan

Menyamakan stok sistem dengan stok fisik, melengkapi nomor batch dan ED untuk batch legacy, lalu menghentikan spreadsheet stok. Akhir fase ini adalah **go-live MVP-1**.

## 2. Ruang lingkup

**Termasuk:** sesi opname per lokasi, penghitungan, tinjauan selisih, penyesuaian dengan persetujuan, pelengkapan batch legacy, checklist go-live, pelatihan.
**Tidak termasuk:** opname berbasis barcode/mobile (Fase 7).

## 3. Pengguna

`staf_gudang` dan `staf_depo` (menghitung), `kepala_depo` (membuka sesi, meninjau, menyetujui).

## 4. Kebutuhan fungsional

| ID | Kebutuhan |
| --- | --- |
| FR-4.1 | Buka sesi opname per lokasi: sistem membekukan snapshot (`snapshot_at`) berisi saldo per batch pada saat itu |
| FR-4.2 | Selama sesi `counting`, transaksi baru di lokasi itu dicatat tetapi ditandai; selisih dihitung terhadap snapshot disesuaikan mutasi sesudahnya |
| FR-4.3 | Input hasil hitung per item x batch (tabel, impor Excel, atau tempel); lembar hitung dapat dicetak tanpa saldo sistem (hitung buta) |
| FR-4.4 | Tinjauan selisih: daftar selisih (qty, nilai), filter, komentar; ambang selisih besar ditandai |
| FR-4.5 | Persetujuan: membuat `stock_adjustments` jenis `selisih_opname` dengan baris per batch; mutasi `opname_in` / `opname_out` saat diposting |
| FR-4.6 | **Pelengkapan batch legacy:** untuk batch `is_legacy`, pengguna mengisi nomor batch dan ED sebenarnya; sistem mengganti identitas batch lewat penyesuaian terdokumentasi (mutasi keluar dari batch legacy, masuk ke batch bernomor) atau memperbarui batch bila belum ada transaksi lain (aturan: lihat bagian 8) |
| FR-4.7 | Penyesuaian di luar opname (jenis `koreksi`, `rusak`) dengan alasan wajib dan persetujuan |
| FR-4.8 | Penutupan sesi: setelah semua penyesuaian posted, sesi `closed`; saldo awal operasional baru dicatat |
| FR-4.9 | Checklist go-live: saldo awal terimpor, parallel run selesai, opname semua lokasi disetujui, pengguna terlatih, backup diuji |
| FR-4.10 | Mode baca-saja untuk spreadsheet: ekspor "stok akhir" sebagai arsip dan tanda pemutusan |
| FR-4.11 | Laporan hasil opname: ringkasan selisih per lokasi dan kategori, nilai selisih, persentase item selisih |

## 5. Data

Tabel: `stock_opname_sessions`, `stock_opname_lines`, `stock_adjustments`, `stock_adjustment_lines`, `batches`, `stock_balances`, `stock_movements`, `audit_logs`.

## 6. API

| Method | Path | Izin |
| --- | --- | --- |
| POST | `/api/v1/opname-sessions` (buka, `location_id`) | `stock.opname.run` |
| GET | `/api/v1/opname-sessions/:id` (snapshot dan baris) | `stock.opname.run` |
| PUT | `/api/v1/opname-sessions/:id/counts` | `stock.opname.run` |
| POST | `/api/v1/opname-sessions/:id/submit-review` | `stock.opname.run` |
| POST | `/api/v1/opname-sessions/:id/approve` | `stock.adjustment.approve` |
| POST | `/api/v1/opname-sessions/:id/close` | `stock.adjustment.approve` |
| POST | `/api/v1/batches/:id/complete-legacy` (nomor batch, ED) | `stock.adjustment.request` |
| POST | `/api/v1/stock-adjustments` (`koreksi`, `rusak`) | `stock.adjustment.request` |
| POST | `/api/v1/stock-adjustments/:id/approve` | `stock.adjustment.approve` |
| GET | `/api/v1/reports/opname/:id` | `report.read` |

## 7. Layar UI

Daftar sesi opname; layar hitung (tabel item x batch, pencarian cepat, kolom hasil hitung); layar tinjauan selisih; formulir lengkapi batch legacy (antrean batch legacy dengan stok > 0); checklist go-live.

## 8. Aturan bisnis dan validasi

- Satu sesi aktif per lokasi pada satu waktu.
- Penyesuaian selalu lewat dokumen dengan persetujuan; saldo tidak diubah langsung.
- Melengkapi batch legacy: bila nomor batch tujuan **sudah ada** untuk item itu, saldo dipindah lewat penyesuaian (keluar dari legacy, masuk ke batch bernomor); bila **belum ada**, batch legacy diganti nama dan ED diisi (satu audit log), dengan harga tetap.
- Selisih di atas ambang (default 5% qty atau nilai tertentu) memerlukan komentar penghitung kedua.
- Batch legacy dengan stok > 0 muncul di dashboard "perlu dilengkapi" sampai selesai.

## 9. Non-fungsional

- Snapshot dibuat < 5 detik untuk 1.400 item x batch.
- Lembar hitung dapat diekspor/dicetak; tampilan nyaman di tablet.

## 10. Acceptance criteria

1. **Snapshot:** membuka sesi menyimpan saldo per batch pada `snapshot_at`; perubahan saldo sesudahnya tidak mengubah snapshot.
2. **Selisih:** hitung 95 vs sistem 100 menghasilkan selisih -5 dan nilai = 5 x harga batch.
3. **Persetujuan:** setelah `kepala_depo` menyetujui, mutasi `opname_out` -5 diposting dan saldo menjadi 95.
4. **Tanpa persetujuan:** tidak ada perubahan saldo.
5. **Legacy diganti nama:** batch `LEGACY-2` tanpa konflik dilengkapi nomor batch `ABC123` dan ED; riwayat mutasi tetap terhubung dan audit tercatat.
6. **Legacy dipindah:** bila `ABC123` sudah ada, saldo berpindah lewat penyesuaian dan batch legacy menjadi nol.
7. **Satu sesi aktif:** membuka sesi kedua untuk lokasi yang sama ditolak.
8. **Go-live:** checklist tidak dapat ditandai selesai bila masih ada sesi opname belum ditutup.
9. **Laporan:** persentase item selisih dan nilai selisih sama dengan hitungan manual pada fixture.

## 11. Pengujian

Integrasi (snapshot vs transaksi paralel, penyesuaian, pelengkapan legacy kedua skenario), E2E (satu sesi lengkap), uji penerimaan pengguna (UAT) dengan data nyata di staging.

## 12. Poin terbuka

#1 penanganan data lama tanpa nomor batch, ambang selisih besar, siapa saja yang berwenang menyetujui, dan jadwal opname per lokasi.

## 13. Definition of Done

Lihat `00-overview.md` bagian 5, ditambah: UAT ditandatangani `kepala_depo`; spreadsheet stok dihentikan pada tanggal yang disepakati; rencana rollback (kembali ke spreadsheet) tertulis untuk minggu pertama.
