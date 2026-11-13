# Glosarium Domain

Istilah yang dipakai di spreadsheet dan aplikasi. Istilah bertanda (?) maknanya **belum dikonfirmasi** (lihat daftar validasi di PRD utama).

| Istilah | Arti | Padanan di sistem |
| --- | --- | --- |
| Depo farmasi | Unit pelayanan farmasi (Rajal, IGD, Ranap, IBS, HD, dst.) | `locations` (`depo`) |
| Gudang | Tempat penyimpanan utama yang menerima barang dari supplier | `locations` (`gudang`) |
| Obat | Kategori barang farmasi berupa obat | `items.item_type = 'obat'` |
| BMHP | Bahan Medis Habis Pakai | `items.item_type = 'bmhp'` |
| Kodifikasi | Kode unik item, mis. AA0096, BK0001, CL0105-B | `items.code` |
| Kode berakhiran "-B" (?) | Arti belum dikonfirmasi; disimpan apa adanya | `items.code` |
| Generik / Merk | Nama zat aktif / nama dagang | `generic_name` / `brand_name` |
| Bentuk sediaan | Tablet, Kapsul, Cream, Injeksi, dst. | `dosage_forms` |
| Kekuatan | Dosis/ukuran, mis. 200 mg | `items.strength` |
| ATC / DDD | Klasifikasi anatomical-therapeutic-chemical / dosis harian | `atc_code`, `ddd` |
| Satuan kecil / besar | Satuan terkecil (Tablet, Ampul, Pcs) / kemasan (Box, Dus) | `base_unit_id` / `purchase_unit_id` |
| Isi kemasan | Jumlah satuan kecil per satuan besar | `pack_size` |
| E-katalog / Non e-katalog | Barang yang tersedia di katalog elektronik pengadaan pemerintah atau tidak | `catalog_type` |
| E-purchasing | Pemesanan lewat e-katalog | `order_channel = 'e_purchasing'` |
| PO manual | Pemesanan di luar e-katalog | `order_channel = 'manual'` |
| PPK | Pejabat Pembuat Komitmen | `ppk_released_at` (tanggal rilis PDF PPK) |
| No ID Paket | Nomor paket pada e-purchasing | `purchase_orders.package_id` |
| Penyedia / Distributor | Pabrik atau pemegang paket / penyalur barang | `suppliers` (`penyedia`, `distributor`) |
| PBF | Pedagang Besar Farmasi (distributor); "retur PBF" = retur ke distributor | `stock_returns` (`retur_pbf`) |
| Formularium RS | Daftar obat yang disetujui di rumah sakit | `formulary_status` |
| Fornas | Formularium Nasional (generik / non generik) | `fornas_class` |
| High Alert, Life Saving | Sub kategori obat berisiko tinggi / penyelamat nyawa | `item_categories` |
| Surat jalan | Dokumen pengiriman dari pabrik/supplier; memuat nomor batch | `receipts.delivery_note_number` |
| Batch / lot | Kelompok produksi dengan nomor batch, ED, dan harga | `batches` |
| ED / Exp | Tanggal kedaluwarsa | `batches.expiry_date` |
| FEFO | First Expired First Out: keluarkan yang ED-nya terdekat dulu | Alokasi pengeluaran |
| Penerimaan | Barang masuk ke gudang | `receipts` |
| Pengeluaran | Barang keluar ke depo/unit/ruangan | `issues` |
| Amprahan | Permintaan barang dari ruangan/depo ke gudang | `requisitions` |
| Mutasi | Perpindahan stok antar lokasi | `transfer_out` / `transfer_in` |
| Retur apotek | Pengembalian barang dari unit/ruangan ke gudang/depo | `stock_returns` (`retur_apotek`) |
| Expired | Barang kedaluwarsa yang dikeluarkan dari stok | `stock_adjustments` (`expired`) |
| Opname | Penghitungan fisik stok dan penyesuaian selisih | `stock_opname_sessions` |
| Perencanaan 3 bulan | Kebutuhan 3 bulan ke depan per item | `procurement_plan_items.planned_qty` (A) |
| Sisa perencanaan | Rencana dikurangi penerimaan pada periode: A - (B+C+D) | `v_plan_remaining` |
| Safety stok | Batas stok pengaman | `item_planning_params.safety_stock` |
| Min | Stok minimum | `item_planning_params.min_stock` |
| Status CITO | Stok 0, perlu segera | `v_item_stock_status` = `cito` |
| Menipis / Menipis CITO | Stok <= min / <= safety | `menipis` / `menipis_cito` |
| Fast Moving Kat 1/2, Slow, Non Moving | Kelas perputaran barang | `moving_class` |
| Harga perencanaan | Harga acuan untuk perencanaan | `items.reference_price` |
| Hutang logistik ke pelayanan (?) | Dugaan: permintaan pelayanan yang belum terpenuhi | `v_requisition_outstanding` |
| Hibah | Barang pemberian pihak lain | `source_type = 'hibah'` |
| Program (Dinkes) | Barang program dari Dinas Kesehatan | `source_type = 'program'` |
| Pinjaman | Barang pinjam masuk/keluar | `source_type = 'pinjaman'`, `stock_loans` (provisional) |
| BTT (?) | Kepanjangan dan alur belum dikonfirmasi; kode EK... | `source_type = 'btt'` (provisional) |
| Kolom M / E (?) | Dugaan: Manual / E-Purchasing pada penerimaan harian | `receipts.order_channel` |
| Rj, Rp, IGD, OK, HD, Lab, Rad | Unit pengeluaran: Rawat jalan, Rawat inap (?), IGD, Kamar operasi, Hemodialisa, Laboratorium, Radiologi | `locations` |
| Ruangan | Unit pelayanan peminta barang (±50 ruangan) | `locations` (`ruangan`) |
