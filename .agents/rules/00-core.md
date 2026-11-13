---
trigger: always_on
---
# Aturan inti (selalu aktif)

Aturan ini mengikat developer maupun AI agent. Baca juga PRD fase aktif di `docs/prd/` dan `docs/STRUCTURE.md`. Rule lain di folder ini dimuat sesuai topik (lihat deskripsi masing-masing).

Kata kunci: **WAJIB** = tidak boleh dilanggar; **JANGAN** = dilarang; **SEBAIKNYA** = default, boleh menyimpang dengan alasan tertulis di PR.

## 0. Aturan emas (pelanggaran = PR ditolak)

1. **WAJIB** semua primary key `uuid` v7. **JANGAN** memakai `serial`, `bigserial`, `identity`, atau sequence untuk PK.
2. **WAJIB** stok hanya berubah lewat `PostingService` (insert ledger + update saldo dalam satu transaksi). **JANGAN** `UPDATE stock_balances` atau `INSERT stock_movements` dari tempat lain.
3. **JANGAN** edit atau hapus baris `stock_movements` dan `audit_logs` (append-only). Koreksi = mutasi `reversal` baru.
4. **WAJIB** batch = (item, nomor batch dari surat jalan). Penerimaan tanpa nomor batch ditolak (kecuali impor legacy yang ditandai `is_legacy`).
5. **WAJIB** semua qty disimpan dalam satuan kecil; konversi hanya di batas input/tampilan.
6. **JANGAN** memakai `number`/float untuk uang atau qty. Pakai string desimal dari DB + `decimal.js`.
7. **WAJIB** setiap endpoint menyatakan izin dan memfilter lokasi pengguna di server. UUID bukan pengganti otorisasi.
8. **WAJIB** setiap aksi tulis menghasilkan `audit_logs`.
9. **JANGAN** mengarang aturan bisnis. Bila PRD menandai poin "validasi terbuka" (#1-#17 di PRD utama), berhenti dan tanya pemilik proses; jangan memilih sendiri.
10. **WAJIB** perubahan skema lewat migrasi; **JANGAN** mengubah DB manual atau mengedit migrasi yang sudah dirilis.
11. **JANGAN** menaruh rahasia (password, token, kunci) di repo, log, atau respons.
12. **WAJIB** pengujian untuk aturan stok, harga, dan batch sebelum merge.

## 2. Aturan domain

- **Ledger:** saldo = jumlah mutasi. Tanda mutasi mengikuti `CHECK` pada `movement_type` (masuk positif, keluar negatif).
- **Batch:** harga (`unit_cost`) dan ED melekat pada batch. Nomor batch sama dengan harga/ED berbeda = peringatan + konfirmasi + audit; **bukan** menimpa harga.
- **Nilai persediaan:** `qty batch x unit_cost batch` sampai poin #3 diputuskan; simpan snapshot `unit_cost` pada tiap mutasi.
- **FEFO:** ED terdekat dulu; batch legacy tanpa ED lebih dulu (asumsi, poin #14). Mengganti hasil FEFO butuh alasan.
- **Dokumen:** status `draft -> posted -> cancelled`. `posted` tidak dapat diubah. Pembatalan = `reversal`, dan ditolak bila stok batch sudah terpakai.
- **Status stok:** `0 = cito`; `<= safety = menipis_cito`; `<= min = menipis`; selain itu `aman` (nilai baku lowercase di DB; label tampilan ditentukan FE).
- **Lokasi:** hanya lokasi `holds_stock = true` yang punya saldo. Staf hanya dapat memposting dari lokasi yang ditugaskan.
- **Nomor dokumen:** dibuat dari `document_counters` dengan kunci baris; hanya untuk tampilan.
- **Normalisasi teks master:** trim, huruf besar-kecil seragam untuk nilai pilihan; kode item disimpan apa adanya (jangan ubah "-B").

## 11. Dokumentasi

- Keputusan arsitektur penting ditulis sebagai ADR di `docs/adr/` (konteks, keputusan, konsekuensi).
- Perubahan perilaku yang memengaruhi PRD diperbarui di PRD fase terkait pada PR yang sama.
- Kode ditulis dalam bahasa Inggris (nama, komentar teknis); istilah domain mengikuti `docs/glossary.md`; teks untuk pengguna dalam Bahasa Indonesia.

## 12. Panduan khusus AI agent

1. Mulai dengan membaca PRD fase aktif dan FR/AC yang dikerjakan; kerjakan hanya cakupannya.
2. Cari pola yang sudah ada sebelum membuat yang baru; gunakan skill di `.agents/skills/`.
3. Jangan menambah dependensi tanpa alasan; sebut alasan di PR.
4. Jika aturan bisnis tidak jelas atau terkait poin validasi terbuka: berhenti, tulis pertanyaan spesifik, jangan menebak.
5. Jalankan lint, typecheck, dan pengujian sebelum menyatakan selesai; laporkan hasil nyata, termasuk yang gagal.
6. Jangan menyentuh berkas di luar cakupan tugas; jangan menulis ulang migrasi lama atau mengubah `schema.sql` tanpa migrasi.
7. Jangan menjalankan perintah destruktif (drop, truncate, force push) tanpa persetujuan eksplisit.
