# PRD Fase 7: Barang Khusus dan Hardening

> **Repositori ini: backend.** Kerjakan semua FR kecuali bagian "Layar UI" (dikerjakan di repo `depo-farmasi-frontend`). PRD ini adalah sumber utama; repo frontend menyalinnya dengan `pnpm prd:sync`.


**MVP-3** · Prasyarat: Fase 6 · Estimasi: berkelanjutan (dipecah per sprint)

## 1. Tujuan

Menangani kasus yang di spreadsheet punya sheet atau kolom sendiri (hibah, program, pinjaman, BTT) setelah definisinya divalidasi, serta memperkuat aplikasi: notifikasi, barcode, integrasi, kinerja, dan ketahanan.

## 2. Ruang lingkup

Dipecah menjadi paket yang dapat dirilis sendiri:

| Paket | Isi | Syarat mulai |
| --- | --- | --- |
| 7A | Hibah dan program Dinkes | Poin #10 selesai |
| 7B | Pinjaman (`stock_loans`) | Poin #9 selesai |
| 7C | BTT | Poin #8 selesai |
| 7D | Notifikasi eksternal | Pilihan kanal disepakati |
| 7E | Barcode dan mobile opname | Perangkat tersedia |
| 7F | Integrasi (e-katalog, SIMRS, keuangan) | Kebutuhan dan API pihak lain jelas |
| 7G | Hardening: kinerja, keamanan, DR | Berjalan terus |

## 3. Pengguna

Sesuai paket; `kepala_depo` pemilik keputusan atas definisi proses.

## 4. Kebutuhan fungsional

| ID | Kebutuhan |
| --- | --- |
| FR-7.1 (7A) | Penerimaan sumber `hibah` / `program` dengan donor (supplier jenis `donor`), harga boleh 0 dengan nilai acuan terpisah; laporan penerimaan dan pemakaian per sumber untuk pelaporan ke pemberi |
| FR-7.2 (7A) | Penandaan batch `source_type` pada seluruh laporan agar nilai pembelian tidak tercampur dengan hibah/program |
| FR-7.3 (7B) | Pinjam masuk dan pinjam keluar antar pihak (`stock_loans`), pelunasan sebagian/penuh, jatuh tempo, status open / partially_settled / settled |
| FR-7.4 (7B) | Pelunasan pinjaman memakai penerimaan atau pengeluaran biasa yang ditautkan ke pinjaman |
| FR-7.5 (7C) | Alur BTT sesuai definisi yang divalidasi: penerimaan, amprahan, pengeluaran (`pengeluaran_btt`), laporan terpisah |
| FR-7.6 (7D) | Notifikasi email / WhatsApp / push untuk stok kritis, ED, PO terlambat; preferensi per pengguna; ringkasan harian |
| FR-7.7 (7E) | Pindai barcode untuk pencarian item, input penerimaan, dan hitung opname; aplikasi web responsif / PWA untuk perangkat genggam |
| FR-7.8 (7F) | Ekspor/impor data rencana dan PO yang kompatibel dengan e-katalog atau e-purchasing bila diperlukan |
| FR-7.9 (7F) | Integrasi SIMRS (resep atau pemakaian) bila dibutuhkan; tinjau ulang perlindungan data pribadi (UU PDP) |
| FR-7.10 (7G) | Profil dan optimasi query lambat (`pg_stat_statements`), indeks tambahan, tinjau partisi dan retensi |
| FR-7.11 (7G) | Uji beban (mis. k6) pada alur posting dan laporan; target dari NFR |
| FR-7.12 (7G) | Latihan pemulihan bencana (backup/PITR) dan rollback rilis; runbook operasional |
| FR-7.13 (7G) | Pemindaian keamanan dependensi dan image, uji penetrasi ringan, tinjau hak akses berkala |
| FR-7.14 (7G) | Pelatihan pengguna, panduan singkat dalam aplikasi, daftar perubahan rilis |

## 5. Data

`stock_loans` (provisional, sudah ada di `schema.sql`), `batches.source_type`, `receipts.source_type`, `issues.issue_type`, tabel preferensi notifikasi (baru, diusulkan: `notification_preferences`). Perubahan skema lain lewat migrasi dengan pola expand, migrate, contract.

## 6. API

Mengikuti paket. Pola yang dipakai ulang: dokumen draf, `post` dengan `Idempotency-Key`, `cancel` lewat `reversal`. Endpoint rinci ditulis di PRD paket saat paket dimulai (`docs/prd/phase-7a-*.md`, dst.).

## 7. Layar UI

Sesuai paket; selalu memperluas layar yang sudah ada (bukan modul terpisah) agar pengguna tidak belajar alur baru.

## 8. Aturan bisnis dan validasi

- Definisi hibah, program, pinjaman, dan BTT **tidak dikodekan sebelum dikonfirmasi** (poin #8, #9, #10).
- Semua alur khusus tetap melewati PostingService; tidak ada jalur tulis stok baru.
- Setiap paket menambah acceptance criteria dan uji otomatis sebelum dirilis.

## 9. Non-fungsional

- Uji beban: 50 pengguna bersamaan pada alur posting dan laporan; p95 sesuai target fase sebelumnya.
- RPO <= 15 menit, RTO <= 4 jam diuji lewat latihan pemulihan.
- Zero-downtime deploy untuk perubahan skema yang kompatibel mundur.

## 10. Acceptance criteria (tingkat tinggi; dirinci per paket)

1. **7A:** penerimaan hibah menambah stok tanpa masuk nilai pembelian; laporan per sumber menunjukkan penerimaan dan pemakaian.
2. **7B:** pinjam masuk 100 dan pelunasan 60 menunjukkan sisa 40; status `partially_settled`.
3. **7C:** sesuai definisi BTT yang disepakati; stok BTT tidak tercampur dengan stok utama bila diputuskan terpisah.
4. **7D:** alert stok kritis terkirim satu kali per kejadian ke penerima yang berhak.
5. **7E:** pindai barcode memilih item benar; hitung opname lewat ponsel tersinkron.
6. **7G:** latihan pemulihan mengembalikan data dalam RTO; uji beban lulus target.

## 11. Pengujian

Mengikuti paket; ditambah uji beban dan latihan pemulihan terjadwal.

## 12. Poin terbuka

#8 BTT, #9 pinjaman, #10 hibah dan program, kebutuhan integrasi, pilihan kanal notifikasi.

## 13. Definition of Done

Per paket: lihat `00-overview.md` bagian 5. Untuk seluruh fase: seluruh poin validasi pada PRD utama bertanda selesai atau diputuskan ditunda secara tertulis.
