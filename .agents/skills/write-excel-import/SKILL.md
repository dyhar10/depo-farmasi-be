---
name: write-excel-import
description: Gunakan saat menulis impor Excel (item, saldo awal, penerimaan) dengan dry-run, normalisasi, dan rekonsiliasi.
---
# Menulis impor Excel (dengan dry-run)

1. Parser membaca sheet yang disebut di PRD (mis. PENERIMAAN MEI) tanpa mengeksekusi rumus; batas ukuran berkas dan jumlah baris.
2. Petakan kolom lewat tabel di `docs/database/design-notes.md` bagian 3. Simpan asal baris di `legacy_ref`/`import_job_errors`.
3. Normalisasi: trim, huruf besar-kecil seragam, `#N/A` -> NULL, desimal ber-locale benar.
4. Mode **dry-run** (default): validasi semua baris, hitung ringkasan dan rekonsiliasi (total per kode vs sumber), simpan galat di `import_job_errors`, **tanpa menulis data**.
5. Mode eksekusi: dalam transaksi per potongan (mis. 500 baris), tulis lewat service domain (bukan SQL langsung ke saldo); saldo awal lewat PostingService (`opening`).
6. Idempotensi: hash berkas (`file_sha256`); eksekusi ulang butuh konfirmasi.
7. Uji dengan fixture kecil (200 baris) yang memuat kasus kotor: kode ganda, `#N/A`, "Non ekatalog" vs "Non Ekatalog", harga bervarian.

**Selesai bila:** dry-run dan eksekusi menghasilkan angka yang sama dengan laporan rekonsiliasi, dan galat per baris jelas.
