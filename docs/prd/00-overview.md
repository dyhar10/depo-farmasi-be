# PRD 00: Ringkasan & Peta Fase

> **Repositori ini: backend.** Kerjakan semua FR kecuali bagian "Layar UI" (dikerjakan di repo `depo-farmasi-frontend`). PRD ini adalah sumber utama; repo frontend menyalinnya dengan `pnpm prd:sync`.


Aplikasi pengadaan dan pengelolaan barang Depo Farmasi (Obat dan BMHP), pengganti spreadsheet "Pengadaan, Penerimaan dan Pengeluaran". PRD umum (konteks, temuan file, daftar validasi) ada di dokumen PRD utama; folder ini memecahnya menjadi PRD per fase yang bisa langsung dikerjakan.

## 1. Tujuan produk

1. Satu sumber data stok yang akurat, dihitung dari ledger mutasi, bukan diketik.
2. Perencanaan 3 bulan, PO, penerimaan, dan pengeluaran terhubung dalam satu alur.
3. Penelusuran per batch (nomor batch dari surat jalan, harga, ED, supplier) dan nilai persediaan yang benar.
4. Peringatan otomatis: stok menipis, mendekati ED, slow/non moving.

## 2. Prinsip yang berlaku di semua fase

- **Stok = ledger.** `stock_movements` append-only; `stock_balances` hanya berubah lewat posting (lihat `docs/database/design-notes.md` bagian 4).
- **Batch = item + nomor batch** dari surat jalan pabrik/supplier. Harga dan ED melekat pada batch.
- **Satuan kecil** adalah satuan penyimpanan; satuan besar hanya untuk input dan tampilan.
- **Dokumen tidak dihapus**, hanya dibatalkan lewat mutasi balik.
- **Primary key UUID v7**, tanpa auto-increment.
- **Setiap fase dapat dirilis dan diuji sendiri.** Fase tidak boleh meninggalkan data yang menggantung.

## 3. Peta fase dan MVP

| MVP | Fase | Fokus | Estimasi* | Prasyarat | Gate keluar |
| --- | --- | --- | --- | --- | --- |
| **MVP-1: Stok menggantikan spreadsheet** | 0 | Fondasi, auth, audit, CI/CD | 2 minggu | - | Deploy otomatis ke staging berjalan |
| | 1 | Master data, impor, saldo awal | 3 minggu | 0 | Total stok awal per kode = spreadsheet |
| | 2 | Penerimaan barang | 3 minggu | 1 | Penerimaan sebulan dapat diinput ulang tanpa selisih |
| | 3 | Pengeluaran, distribusi, amprahan | 4 minggu | 2 | Stok akhir sistem = stok akhir spreadsheet (parallel run) |
| | 4 | Opname dan penyesuaian, go-live | 2 minggu | 3 | Opname pertama disetujui, spreadsheet stok dihentikan |
| **MVP-2: Perencanaan dan wawasan** | 5 | Perencanaan 3 bulan dan PO | 4 minggu | 4 | Status menipis dan sisa perencanaan = hasil manual |
| | 6 | Dashboard, laporan, alert | 3 minggu | 5 | Laporan ketersediaan diterima pengguna |
| **MVP-3: Kasus khusus dan hardening** | 7 | Hibah/program/pinjaman/BTT, notifikasi, barcode, integrasi | Berkelanjutan | 6 | Poin validasi selesai |

\* Estimasi kasar untuk 2 developer (FE + BE), sprint 2 minggu; sesuaikan setelah Fase 0.

```
Fase 0 -> 1 -> 2 -> 3 -> 4 ==> go-live stok
                         \-> 5 -> 6 -> 7
```

## 4. Peran (ringkas)

`admin`, `kepala_depo`, `perencana`, `staf_gudang`, `staf_depo`, `peminta_ruangan`, `auditor`. Hak akses rinci per peran ada di `docs/database/seed.sql`; akses dibatasi per lokasi lewat `user_role_assignments.location_id`.

## 5. Definition of Done (berlaku untuk setiap fase)

- [ ] Semua FR fase tersebut lulus acceptance criteria.
- [ ] Migrasi database dapat dijalankan dari nol dan di atas data fase sebelumnya.
- [ ] Pengujian otomatis hijau di CI: unit, integrasi (Postgres + Redis asli), E2E alur utama.
- [ ] Hak akses diuji: peran tanpa hak ditolak (403), lokasi lain tidak terlihat.
- [ ] Setiap aksi tulis tercatat di `audit_logs`.
- [ ] Endpoint baru terdokumentasi di OpenAPI; kontrak dibangkitkan ke klien FE.
- [ ] Deploy ke staging otomatis, smoke test hijau; catatan rilis ditulis.
- [ ] Tidak ada TODO tanpa tiket; poin validasi terbuka dicatat di PRD fase.

## 6. Metrik keberhasilan (target awal, perlu disepakati)

| Metrik | Target |
| --- | --- |
| Selisih stok sistem vs hitung fisik | <= 1% item per opname |
| Waktu menyusun rekap perencanaan bulanan | < 30 menit |
| Transaksi dengan jejak audit | 100% |
| Waktu muat daftar master (cache hit, p95) | < 100 ms |
| Waktu API baca umum (p95) | < 500 ms |

## 7. Daftar PRD

| Berkas | Isi |
| --- | --- |
| `phase-0-foundation.md` | Fondasi, auth, RBAC, audit, CI/CD |
| `phase-1-master-data.md` | Master data, impor Excel, saldo awal |
| `phase-2-receiving.md` | Penerimaan barang dan retur ke PBF |
| `phase-3-issuing.md` | Permintaan, pengeluaran, mutasi, retur apotek, expired |
| `phase-4-opname-golive.md` | Opname, penyesuaian, go-live |
| `phase-5-planning-po.md` | Perencanaan 3 bulan, PO manual dan e-purchasing |
| `phase-6-reporting.md` | Dashboard, laporan, alert, job ringkasan |
| `phase-7-special-hardening.md` | Hibah, program, pinjaman, BTT, notifikasi, integrasi |
