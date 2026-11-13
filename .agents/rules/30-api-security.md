---
trigger: model_decision
description: Aturan API REST, cache Redis, keamanan, dan skalabilitas untuk controller, middleware, guard, dan konfigurasi backend.
---
# Aturan API, cache, keamanan, skalabilitas

## 5. API

- Prefiks `/api/v1`; REST berbasis sumber daya jamak; aksi non-CRUD sebagai sub-sumber daya (`POST /receipts/:id/post`).
- Hanya perubahan kompatibel mundur dalam `v1`; perubahan yang memecah = `v2`.
- Daftar mengembalikan `{ data: [...], next_cursor }`. Filter lewat query string.
- Error seragam RFC 7807: `type`, `title`, `status`, `detail`, `code`, `errors[]` (per field), `request_id`.
- Kode HTTP: 400 validasi, 401 belum login, 403 tanpa izin, 404 tak ditemukan atau di luar lingkup lokasi, 409 konflik (status dokumen, versi), 422 aturan bisnis ditolak, 429 rate limit.
- POST pengubah stok menerima `Idempotency-Key`.
- Setiap endpoint terdokumentasi di OpenAPI (skema, izin, contoh error).

## 6. Cache (Redis)

- Cache hanya data statis atau jarang berubah: item, kategori, supplier, lokasi, hak akses, agregat dashboard (TTL pendek). **JANGAN** cache saldo stok, mutasi, atau dokumen transaksi.
- Pola cache-aside; kunci ber-namespace dan versi: `v1:item:{id}`, `v1:items:list:{hash}`, `v1:ref:locations`.
- TTL: master 1 jam, hak akses 10 menit, dashboard 30-60 detik. Browser: TanStack Query `staleTime` 5 menit untuk master.
- Invalidasi lewat event outbox saat data berubah; cegah stampede dengan kunci sementara saat mengisi ulang.
- Aplikasi harus tetap benar bila Redis mati (turun ke DB, bukan gagal).
- HTTP: `ETag` dan `Cache-Control` pada GET master; aset FE ber-hash dengan cache panjang.

## 7. Keamanan

- Password argon2id; kunci setelah 5 gagal; token refresh dirotasi dan disimpan sebagai hash.
- HTTPS wajib; cookie `httpOnly`, `Secure`, `SameSite=Lax`; CORS hanya asal FE yang diizinkan; header keamanan (helmet).
- Rate limit pada login dan endpoint tulis.
- Peran DB terpisah: `app_migrator`, `app_rw`, `app_ro`. Aplikasi tidak memakai superuser.
- Dependensi dipindai di CI; image dipindai sebelum rilis. Rahasia hanya dari variabel lingkungan/secret manager.
- Input impor Excel dianggap tidak tepercaya: batas ukuran, batas baris, validasi tipe, tidak mengeksekusi rumus/makro.
- Tidak ada data pasien di aplikasi. Bila integrasi SIMRS ditambahkan, tinjau ulang kepatuhan data pribadi sebelum merge.

## 10. Skalabilitas (pegangan harian)

- API **stateless**; sesi di JWT + refresh token di DB; cache dan antrean di Redis, sehingga replika API/worker dapat ditambah tanpa mengubah kode.
- Koneksi DB lewat PgBouncer (transaction pooling): **JANGAN** memakai prepared statement bernama atau advisory lock tingkat sesi.
- Baca-berat (laporan, dashboard) boleh diarahkan ke replika; baca-lalu-tulis tetap ke primary.
- Pertumbuhan data ditangani dengan tabel ringkasan dan partisi, bukan dengan memperbesar query.
- Setiap fitur baru menyebut perkiraan volume dan indeks yang dibutuhkan di PR.
