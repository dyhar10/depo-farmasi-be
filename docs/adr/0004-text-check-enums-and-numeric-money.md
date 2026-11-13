# ADR 0004: Enum sebagai text + CHECK; uang dan qty NUMERIC

**Status:** Diterima

## Konteks
Nilai pilihan (status, jenis dokumen, jenis mutasi) akan bertambah seiring fase. Tipe ENUM native PostgreSQL sulit diubah (tidak dapat menghapus nilai, urutan terkunci). Uang dan qty tidak boleh kehilangan presisi.

## Keputusan
- Nilai pilihan disimpan sebagai `text` dengan `CHECK (col IN (...))`; perubahan = satu migrasi.
- Uang `NUMERIC(18,4)`; qty `NUMERIC(18,3)`; di aplikasi dipakai `decimal.js` dan serialisasi string. Tidak ada float.
- Semua qty disimpan dalam satuan kecil; konversi satuan besar hanya di batas input.

## Konsekuensi
- (+) Migrasi nilai pilihan sederhana dan aman; tidak ada galat pembulatan.
- (-) Nilai pilihan terduplikasi di kode (daftar konstanta) dan DB; dijaga uji yang membandingkan keduanya.
