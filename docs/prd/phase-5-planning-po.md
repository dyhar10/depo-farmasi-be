# PRD Fase 5: Perencanaan dan Pengadaan (PO)

> **Repositori ini: backend.** Kerjakan semua FR kecuali bagian "Layar UI" (dikerjakan di repo `depo-farmasi-frontend`). PRD ini adalah sumber utama; repo frontend menyalinnya dengan `pnpm prd:sync`.


**MVP-2** · Prasyarat: Fase 4 · Estimasi: 4 minggu

## 1. Tujuan

Menggantikan sheet PENGADAAN OBAT / BMHP: menyusun perencanaan 3 bulan, memantau status stok terhadap safety/minimum, membuat PO (manual dan e-purchasing), memantau pengiriman per minggu, dan menghitung sisa perencanaan secara otomatis.

## 2. Ruang lingkup

**Termasuk:** parameter perencanaan, status stok otomatis, rekomendasi rencana, rencana 3 bulan, PO dan baris PO, jadwal kirim W1-W5, tautan penerimaan ke PO, sisa perencanaan, daftar "perlu dipesan".
**Tidak termasuk:** integrasi langsung ke e-katalog/LKPP (Fase 7, bila diperlukan), laporan lanjutan (Fase 6).

## 3. Pengguna

`perencana` (susun rencana, buat PO), `kepala_depo` (setujui rencana dan PO), `staf_gudang` (terima barang yang tertaut PO).

## 4. Kebutuhan fungsional

| ID | Kebutuhan |
| --- | --- |
| FR-5.1 | Status stok otomatis per item x lokasi (`v_item_stock_status`): stok 0 = CITO; <= safety = MENIPIS CITO; <= minimum = MENIPIS; selain itu AMAN |
| FR-5.2 | Daftar "perlu dipesan": item berstatus CITO / MENIPIS CITO / MENIPIS, dengan stok, safety, min, pengeluaran bulan lalu, sisa perencanaan, dan PO yang masih berjalan |
| FR-5.3 | Parameter perencanaan per item dapat diubah (safety, min, kelas moving); perubahan tercatat di audit |
| FR-5.4 | Rekomendasi rencana: usulan jumlah dari rerata pengeluaran N bulan terakhir (N dapat diatur) dan parameter; rumus resmi dikonfirmasi pada poin #4 sehingga rumus bersifat konfigurasi, bukan kode keras |
| FR-5.5 | Rencana 3 bulan (`procurement_plans` + `procurement_plan_items`): jumlah rencana (A), harga perencanaan, snapshot safety/min/rerata; status draft, approved, closed, cancelled |
| FR-5.6 | Sisa perencanaan = A - penerimaan terposting dalam periode rencana (`v_plan_remaining`); tampil per item |
| FR-5.7 | PO (`purchase_orders`): jalur manual atau e-purchasing, penyedia, distributor, no. ID paket, tanggal pemesanan, tanggal rilis PDF PPK, tautan rencana |
| FR-5.8 | Baris PO: item, jumlah (satuan kecil), harga, status baris (normal, pengiriman parsial, beli produk lain, nunggu kirim, coret/ganti, peningkatan), catatan |
| FR-5.9 | Jadwal kirim per minggu W1-W5 (`po_line_schedules`) untuk PO manual dan e-purchasing |
| FR-5.10 | Penerimaan dapat ditautkan ke baris PO; jumlah diterima dan sisa PO dihitung otomatis (`v_po_line_received`); status PO berubah ke partially_received / completed |
| FR-5.11 | Alur persetujuan: rencana dan PO disetujui `kepala_depo` sebelum berstatus aktif; perubahan setelah disetujui membuat revisi tercatat |
| FR-5.12 | Hutang logistik ke pelayanan ditampilkan di layar perencanaan (dari `v_requisition_outstanding`) |
| FR-5.13 | Ekspor rencana dan PO ke Excel/PDF, format menyerupai sheet PENGADAAN agar mudah ditinjau |
| FR-5.14 | Impor rencana dari Excel (opsional) untuk periode berjalan |

## 5. Data

Tabel: `item_planning_params`, `procurement_plans`, `procurement_plan_items`, `purchase_orders`, `purchase_order_lines`, `po_line_schedules`, `item_suppliers`, `receipts` (kolom `po_id`), `receipt_lines` (kolom `po_line_id`). View: `v_item_stock_status`, `v_plan_remaining`, `v_po_line_received`, `v_requisition_outstanding`.

## 6. API

| Method | Path | Izin |
| --- | --- | --- |
| GET | `/api/v1/planning/needs-ordering?location_id=&type=` | `plan.write` |
| GET | `/api/v1/planning/recommendation?item_id=&months=` | `plan.write` |
| GET/POST | `/api/v1/plans` | `plan.write` |
| PUT | `/api/v1/plans/:id/items` | `plan.write` |
| POST | `/api/v1/plans/:id/approve` | `plan.approve` |
| GET | `/api/v1/plans/:id/remaining` | `plan.write` |
| GET/POST | `/api/v1/purchase-orders` | `po.write` |
| PUT | `/api/v1/purchase-orders/:id/lines` | `po.write` |
| PUT | `/api/v1/purchase-order-lines/:id/schedule` | `po.write` |
| POST | `/api/v1/purchase-orders/:id/submit`, `/approve`, `/cancel` | `po.write` / `po.approve` |
| GET | `/api/v1/purchase-orders/:id/outstanding` | `po.write` |

## 7. Layar UI

"Perlu dipesan" (tabel berstatus warna dan filter), editor rencana 3 bulan (tabel dapat disunting, tempel dari Excel), daftar dan detail PO dengan jadwal W1-W5, tampilan sisa perencanaan, antrean persetujuan.

## 8. Aturan bisnis dan validasi

- Status stok memakai stok lokasi gudang kecuali ditentukan lain; semua perhitungan dalam satuan kecil.
- Jumlah PO tidak boleh melebihi sisa perencanaan tanpa alasan dan persetujuan.
- Satu item dalam satu rencana hanya satu baris (`UNIQUE (plan_id, item_id)`).
- Jadwal kirim minggu 1-5 per bulan; total jadwal tidak boleh melebihi jumlah baris PO.
- Penerimaan yang tertaut PO mengikuti aturan Fase 2; tidak ada perubahan stok dari modul PO.
- Typo lama (mis. "MENIPISCIT0") tidak dibawa; nilai status baku di kode dan DB.

## 9. Non-fungsional

- Daftar "perlu dipesan" untuk 1.200 item < 1 detik (indeks, cache pendek 30-60 detik).
- Rekomendasi dihitung di server dan dapat dijalankan massal lewat worker.

## 10. Acceptance criteria

1. **Status:** item dengan stok 0, 500 (safety 700, min 1.300), 1.000, dan 2.000 berstatus CITO, MENIPIS CITO, MENIPIS, AMAN.
2. **Kecocokan April-Juni:** untuk sampel item, status menipis dan sisa perencanaan sama dengan hasil spreadsheet (selisih dijelaskan).
3. **Sisa perencanaan:** rencana 8.400, penerimaan terposting 4.200, maka sisa 4.200 dan berubah otomatis saat penerimaan baru diposting.
4. **PO parsial:** PO 1.000 dengan penerimaan 400 membuat status PO `partially_received` dan sisa 600.
5. **Jadwal:** total jadwal W1-W5 melebihi jumlah baris ditolak.
6. **Persetujuan:** PO berstatus draft tidak dapat ditautkan ke penerimaan.
7. **Parameter:** perubahan safety stock langsung mengubah status pada tampilan berikutnya (<= 60 detik karena cache).
8. **Hak akses:** `staf_gudang` tidak dapat membuat PO.
9. **Hutang logistik:** permintaan disetujui 100 dan dipenuhi 60 menampilkan 40 pada layar perencanaan.

## 11. Pengujian

Unit (aturan status, rumus rekomendasi sebagai konfigurasi), integrasi (view sisa perencanaan, penerimaan tertaut PO), E2E (rencana, PO, penerimaan, sisa), perbandingan terhadap sheet PENGADAAN Mei 2026.

## 12. Poin terbuka

#4 rumus safety, minimum, dan perencanaan 3 bulan; #5 ambang kelas moving; #11 definisi hutang logistik; kebutuhan integrasi e-katalog. **Selesaikan #4 sebelum sprint Fase 5 dimulai (workshop dengan perencana).**

## 13. Definition of Done

Lihat `00-overview.md` bagian 5, ditambah: perencanaan satu periode disusun di staging dan ditinjau perencana dibandingkan dengan sheet manual.
