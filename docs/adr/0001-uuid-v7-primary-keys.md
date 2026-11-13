# ADR 0001: Primary key UUID v7, tanpa auto-increment

**Status:** Diterima

## Konteks
Aplikasi menyimpan data stok dan harga yang sensitif. ID berurutan mudah ditebak (risiko IDOR dan enumerasi) dan menyulitkan penggabungan data antar lingkungan/impor. Persyaratan: keamanan dan skalabilitas.

## Keputusan
Semua PK memakai UUID versi 7 (timestamp 48 bit di depan + acak). Dibuat oleh aplikasi atau oleh fungsi `uuid_generate_v7()` di DB (di PostgreSQL 18+ memakai `uuidv7()`). Tidak ada `serial`, `bigserial`, atau `identity`. Nomor dokumen terbaca manusia dibuat terpisah (`document_counters`) dan bukan PK.

## Konsekuensi
- (+) Tidak dapat ditebak; aman digabung antar lingkungan; ID dapat dibuat sebelum insert.
- (+) Berurutan waktu, sehingga indeks B-tree tidak terfragmentasi seperti UUID v4.
- (-) 16 byte per kunci (indeks sedikit lebih besar); dapat diterima untuk skala ini.
- UUID bukan pengganti otorisasi; setiap akses tetap diperiksa izin dan lokasinya.
- CI memeriksa bahwa tidak ada kolom sequence/identity.
