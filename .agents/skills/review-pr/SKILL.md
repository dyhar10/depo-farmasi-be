---
name: review-pr
description: "Gunakan saat meninjau atau menyiapkan pull request backend: checklist kepatuhan terhadap aturan proyek."
---
# Checklist review PR

- [ ] Cakupan sesuai FR/AC di PRD fase; tidak ada perubahan di luar itu.
- [ ] Tidak ada PK auto-increment; tipe uang/qty benar; enum `text` + `CHECK`.
- [ ] Stok hanya berubah lewat PostingService; dokumen `posted` tidak berubah.
- [ ] Endpoint punya izin dan filter lokasi; audit tercatat.
- [ ] Validasi input di server; error memakai format seragam.
- [ ] Migrasi aman (expand/contract bila berisiko), indeks ada, dokumentasi database diperbarui.
- [ ] Tidak ada `OFFSET` pada tabel transaksi, tidak ada `SELECT *`, query baru dicek `EXPLAIN`.
- [ ] Cache hanya untuk data statis; invalidasi lewat outbox; aman bila Redis mati.
- [ ] Uji unit/integrasi/konkurensi relevan ada dan hijau; E2E bila alur utama berubah.
- [ ] Tidak ada rahasia, tidak ada log data sensitif.
- [ ] Teks pengguna Bahasa Indonesia; format angka `id-ID`.
- [ ] Poin validasi terbuka tidak diasumsikan diam-diam.
