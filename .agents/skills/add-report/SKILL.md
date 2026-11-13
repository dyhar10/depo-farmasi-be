---
name: add-report
description: Gunakan saat menambah laporan atau dashboard berbasis tabel ringkasan, keyset pagination, dan ekspor lewat worker.
---
# Menambah laporan

1. Tentukan sumber data: bulan tertutup dari `stock_period_summaries`; bulan berjalan dari ledger/saldo. Tidak memindai ledger penuh.
2. Query dengan keyset pagination dan filter berindeks; cek `EXPLAIN`.
3. Sertakan waktu hitung terakhir dan filter pada hasil.
4. Ekspor besar: antre ke worker, kembalikan `job_id`, unduh saat selesai.
5. Bandingkan hasil dengan sheet padanan (SUMMARY, KETERSEDIAAN BARANG) pada fixture; catat selisih yang wajar.
6. Cache pendek (30-60 detik) bila dibaca sering; jangan untuk laporan yang harus real-time.

**Selesai bila:** angka cocok dengan sheet padanan atau selisihnya dijelaskan, dan p95 sesuai target.
