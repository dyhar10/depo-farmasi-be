# PRD Fase 6: Dashboard, Laporan, dan Alert

> **Repositori ini: backend.** Kerjakan semua FR kecuali bagian "Layar UI" (dikerjakan di repo `depo-farmasi-frontend`). PRD ini adalah sumber utama; repo frontend menyalinnya dengan `pnpm prd:sync`.


**MVP-2** · Prasyarat: Fase 5 · Estimasi: 3 minggu

## 1. Tujuan

Memberikan gambaran stok dan pengadaan secara cepat dan laporan resmi tanpa memindai ledger setiap kali: dashboard, laporan bulanan setara SUMMARY dan KETERSEDIAAN BARANG, serta peringatan otomatis.

## 2. Ruang lingkup

**Termasuk:** job ringkasan bulanan, klasifikasi moving otomatis, dashboard, laporan, ekspor, alert di dalam aplikasi.
**Tidak termasuk:** notifikasi email/WhatsApp (Fase 7).

## 3. Pengguna

`kepala_depo`, `perencana`, `auditor` (semua laporan); staf lain sesuai lokasi.

## 4. Kebutuhan fungsional

| ID | Kebutuhan |
| --- | --- |
| FR-6.1 | Job penutupan periode: mengisi `stock_period_summaries` (stok awal, masuk, keluar, penyesuaian, akhir, nilai) per item x lokasi x bulan dari ledger; dapat dihitung ulang untuk bulan berjalan |
| FR-6.2 | Klasifikasi moving otomatis (Fast Kat 1/Kat 2, Slow, Non Moving) berdasarkan pola pengeluaran; ambang dapat diatur; hasil manual (`moving_class_is_manual`) tidak ditimpa |
| FR-6.3 | Dashboard: jumlah item CITO / menipis, ED < 3 bulan (ambang dapat diatur), nilai persediaan per lokasi, 10 pengeluaran terbesar, item slow/non moving dengan nilai tertahan, batch legacy yang perlu dilengkapi, PO terlambat |
| FR-6.4 | Laporan rekap stok (setara SUMMARY): kategori, kode, nama, stok awal, pembelian, masuk, keluar, stok akhir, nilai, per periode dan lokasi |
| FR-6.5 | Laporan ketersediaan (setara KETERSEDIAAN BARANG): total penyaluran per bulan, jumlah hari, rerata penyaluran per hari, stok tersedia, perkiraan ketersediaan (hari) |
| FR-6.6 | Kartu stok per item/batch: seluruh mutasi dengan saldo berjalan |
| FR-6.7 | Laporan pembelian per supplier, per periode, dan variasi harga per item (membantu melihat naik-turun harga antar batch) |
| FR-6.8 | Laporan ED: batch yang akan kedaluwarsa, nilai berisiko |
| FR-6.9 | Laporan nilai persediaan per lokasi dan kategori sesuai metode yang disepakati (poin #3) |
| FR-6.10 | Ekspor Excel dan PDF; ekspor besar berjalan di worker dan diunduh saat selesai |
| FR-6.11 | Alert dalam aplikasi untuk stok kritis, ED mendekat, PO terlambat; dapat ditandai sudah dibaca |
| FR-6.12 | Semua laporan menyertakan waktu hitung terakhir dan filter yang dipakai |

## 5. Data

Tabel: `stock_period_summaries`, `stock_movements`, `stock_balances`, `batches`, `item_planning_params`, `purchase_orders`, `outbox_events`. Tabel baru yang diusulkan: `notifications` (alert dalam aplikasi: `user_id`, `type`, `payload`, `read_at`) ditambahkan lewat migrasi fase ini.

## 6. API

| Method | Path | Izin |
| --- | --- | --- |
| GET | `/api/v1/dashboard?location_id=` | `report.read` |
| GET | `/api/v1/reports/stock-summary?month=&location_id=&type=` | `report.read` |
| GET | `/api/v1/reports/availability?from=&to=&location_id=` | `report.read` |
| GET | `/api/v1/reports/stock-card?item_id=&batch_id=&from=&to=` | `report.read` |
| GET | `/api/v1/reports/purchases?supplier_id=&from=&to=` | `report.read` |
| GET | `/api/v1/reports/price-variation?item_id=` | `report.read` |
| GET | `/api/v1/reports/expiry?within_months=` | `report.read` |
| POST | `/api/v1/reports/:type/export` (antre, kembalikan `job_id`) | `report.read` |
| GET | `/api/v1/exports/:job_id` | `report.read` |
| GET | `/api/v1/notifications`, POST `/:id/read` | login |
| POST | `/api/v1/admin/period-close?month=` | `kepala_depo` |

## 7. Layar UI

Dashboard dengan kartu angka dan daftar; halaman tiap laporan dengan filter, tabel keyset, dan tombol ekspor; kartu stok; pusat notifikasi.

## 8. Aturan bisnis dan validasi

- Laporan membaca `stock_period_summaries` untuk bulan tertutup dan menghitung langsung dari ledger hanya untuk bulan berjalan.
- Bulan yang sudah ditutup tidak berubah kecuali ada penyesuaian yang secara eksplisit membuka ulang dan menghitung ulang periode.
- Perkiraan ketersediaan (hari) = stok tersedia / rerata penyaluran per hari; bila rerata 0, ditampilkan "tidak terukur", bukan pembagian nol.
- Nilai persediaan memakai `unit_cost` batch (metode final mengikuti poin #3).

## 9. Non-fungsional

- Dashboard p95 < 1 detik (cache 30-60 detik, agregat dari summary dan saldo).
- Laporan bulanan 1.400 item p95 < 3 detik; ekspor < 10 detik untuk satu bulan.
- Job penutupan periode idempoten dan dapat diulang.
- Laporan berat dapat dialihkan ke replika baca.

## 10. Acceptance criteria

1. **Rekap:** untuk Mei 2026, stok awal + masuk - keluar + penyesuaian = stok akhir untuk setiap item; angka sama dengan SUMMARY (selisih dijelaskan).
2. **Ketersediaan:** laporan untuk item sampel sama dengan sheet KETERSEDIAAN BARANG (rerata per hari, perkiraan hari).
3. **Idempoten:** menjalankan penutupan periode dua kali menghasilkan data identik.
4. **Moving:** klasifikasi manual tidak ditimpa job otomatis.
5. **Kartu stok:** saldo akhir kartu stok = saldo di `stock_balances`.
6. **Alert:** batch dengan ED 2 bulan lagi memunculkan alert satu kali per ambang.
7. **Ekspor:** ekspor besar berjalan di worker, UI tidak membeku, berkas dapat diunduh.
8. **Kinerja:** dashboard < 1 detik pada data satu tahun uji.
9. **Pembagian nol:** item tanpa pengeluaran menampilkan "tidak terukur".

## 11. Pengujian

Integrasi (job periode, idempotensi), perbandingan terhadap sheet SUMMARY dan KETERSEDIAAN, uji kinerja pada data sintetis 12 bulan, E2E ekspor.

## 12. Poin terbuka

#3 metode nilai persediaan, #5 ambang moving, format laporan resmi yang diminta pihak luar (Dinkes) untuk ketersediaan.

## 13. Definition of Done

Lihat `00-overview.md` bagian 5, ditambah: laporan ketersediaan ditinjau pemakai dan format ekspor disetujui.
