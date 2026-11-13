# ADR 0002: Stok sebagai ledger append-only + tabel saldo

**Status:** Diterima

## Konteks
Spreadsheet menghitung stok dengan rumus lintas sheet dan rentang tetap yang mudah salah. Perlu jejak lengkap, nilai persediaan benar, dan baca cepat.

## Keputusan
- `stock_movements` (ledger) append-only, dipartisi bulanan; trigger menolak UPDATE/DELETE.
- `stock_balances` (lokasi x batch) menyimpan saldo terkini dan hanya berubah di transaksi yang sama dengan insert ledger, lewat satu `PostingService`.
- `CHECK (quantity >= 0)` sebagai jaring pengaman; kunci baris berurutan mencegah deadlock.
- Koreksi lewat mutasi `reversal`, bukan edit.
- Laporan membaca `stock_period_summaries` (diisi worker), bukan memindai ledger.

## Konsekuensi
- (+) Jejak audit lengkap, saldo dapat dibangun ulang dari ledger, laporan cepat.
- (-) Penulisan dua tempat (ledger + saldo) harus atomik; dijaga PostingService dan uji konkurensi.
- (-) Perlu tabel ringkasan dan job penutupan periode.
