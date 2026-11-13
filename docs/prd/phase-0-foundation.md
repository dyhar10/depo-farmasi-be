# PRD Fase 0: Fondasi

> **Repositori ini: backend.** Kerjakan semua FR kecuali bagian "Layar UI" (dikerjakan di repo `depo-farmasi-frontend`). PRD ini adalah sumber utama; repo frontend menyalinnya dengan `pnpm prd:sync`.


**MVP-1** · Prasyarat: tidak ada · Estimasi: 2 minggu

## 1. Tujuan

Menyediakan kerangka teknis yang aman dan dapat dirilis otomatis, agar fase berikutnya hanya menambah fitur: autentikasi, otorisasi per peran dan lokasi, jejak audit, konvensi API, dan pipeline CI/CD.

## 2. Ruang lingkup

**Termasuk:** dua repositori (backend dan frontend), kerangka FE dan API, autentikasi, RBAC + lingkup lokasi, audit log, penanganan error seragam, idempotensi, migrasi DB, seed, health check, logging, CI/CD ke staging.
**Tidak termasuk:** fitur stok, master data (Fase 1).

## 3. Pengguna

Admin sistem (kelola pengguna); semua peran lain hanya login.

## 4. Kebutuhan fungsional

| ID | Kebutuhan |
| --- | --- |
| FR-0.1 | Dua repositori terpisah: `depo-farmasi-backend` (NestJS, struktur sesuai `docs/STRUCTURE.md`) dan `depo-farmasi-frontend` (Vue 3). Kontrak lewat OpenAPI (`docs/openapi.json`); klien dan tipe FE dibangkitkan dari sana |
| FR-0.2 | Login username + password; password di-hash argon2id; akun terkunci sementara setelah 5 kali gagal |
| FR-0.3 | Access token JWT berumur pendek (15 menit); refresh token di cookie httpOnly, disimpan sebagai hash, dirotasi tiap pemakaian; pemakaian ulang token lama mencabut seluruh keluarga token |
| FR-0.4 | Wajib ganti password saat login pertama (`must_change_password`) |
| FR-0.5 | RBAC: izin dari `role_permissions`; penetapan peran per lokasi (`user_role_assignments.location_id`, NULL = semua lokasi) |
| FR-0.6 | Guard API: setiap endpoint menyatakan izin yang dibutuhkan; query otomatis memfilter lokasi pengguna |
| FR-0.7 | Audit log untuk semua aksi tulis: siapa, kapan, entitas, nilai lama dan baru, `request_id`, IP |
| FR-0.8 | Format error seragam (RFC 7807 `application/problem+json`) dengan kode error stabil |
| FR-0.9 | Dukungan header `Idempotency-Key` untuk POST yang mengubah stok (disimpan di `idempotency_keys`) |
| FR-0.10 | Pembuat nomor dokumen (`document_counters`) aman konkuren: `RCV-2026-11-000001` |
| FR-0.11 | Health check `/health/live` dan `/health/ready` (cek DB dan Redis) |
| FR-0.12 | Logging terstruktur (pino) dengan `request_id`; Sentry untuk error |
| FR-0.13 | CRUD pengguna dan penetapan peran (admin saja) |
| FR-0.14 | Pipeline CI/CD seperti di `docs/architecture.md` bagian 6 |
| FR-0.15 | Worker (BullMQ) dasar: memproses `outbox_events` dan menjalankan `ensure_future_partitions()` bulanan |

## 5. Data

Tabel: `users`, `roles`, `permissions`, `role_permissions`, `user_role_assignments`, `refresh_tokens`, `audit_logs`, `idempotency_keys`, `outbox_events`, `document_counters`. Seed: `docs/database/seed.sql`.

## 6. API

| Method | Path | Izin |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | publik |
| POST | `/api/v1/auth/refresh` | cookie refresh |
| POST | `/api/v1/auth/logout` | login |
| POST | `/api/v1/auth/change-password` | login |
| GET | `/api/v1/me` | login (profil, peran, lokasi, izin) |
| GET/POST/PATCH | `/api/v1/users`, `/api/v1/users/:id` | `iam.user.manage` |
| PUT | `/api/v1/users/:id/roles` | `iam.user.manage` |
| GET | `/api/v1/roles` | `iam.user.manage` |
| GET | `/health/live`, `/health/ready` | publik |

## 7. Layar UI

Login, ganti password, kerangka aplikasi (sidebar menurut izin, pemilih lokasi aktif), daftar pengguna dan form peran, halaman 403/404.

## 8. Aturan dan validasi

- Username unik tanpa membedakan huruf besar-kecil (`citext`); password minimal 10 karakter.
- Pengguna nonaktif atau terkunci tidak dapat login dan semua token aktifnya dicabut.
- Menghapus pengguna = soft delete; pengguna dengan riwayat transaksi tidak pernah dihapus fisik.
- Admin tidak dapat mencabut peran admin terakhir.

## 9. Non-fungsional

- Rate limiting login (per IP dan per username).
- HTTPS wajib di staging dan produksi; cookie `Secure`, `SameSite=Lax`.
- Respons API baca umum p95 < 500 ms.
- Rahasia hanya dari variabel lingkungan / secret manager; tidak ada di repo.

## 10. Acceptance criteria

1. **Login sukses:** diberi kredensial valid, saat login, maka menerima access token dan cookie refresh; `/me` mengembalikan izin sesuai peran.
2. **Lockout:** diberi 5 kali password salah, saat percobaan ke-6 dengan password benar, maka ditolak sampai `locked_until` lewat.
3. **Rotasi token:** diberi refresh token yang sudah dipakai, saat dipakai lagi, maka seluruh keluarga token dicabut dan pengguna harus login ulang.
4. **RBAC:** pengguna `peminta_ruangan` memanggil endpoint `po.write`, maka 403; audit mencatat penolakan.
5. **Lingkup lokasi:** pengguna dengan peran di lokasi A tidak dapat membaca data lokasi B (diuji di tiap modul berikutnya).
6. **Audit:** setiap POST/PATCH/DELETE menghasilkan baris `audit_logs` dengan nilai lama dan baru.
7. **Idempotensi:** dua POST dengan `Idempotency-Key` sama menghasilkan satu efek dan respons identik.
8. **Penomoran:** 50 permintaan paralel menghasilkan 50 nomor dokumen unik tanpa celah ganda.
9. **CI/CD:** merge ke `main` men-deploy ke staging otomatis dan smoke test lolos dalam < 15 menit.

## 11. Pengujian

Unit (hashing, guard, penomoran), integrasi dengan Postgres + Redis asli (auth, rotasi token, idempotensi), E2E Playwright (login, ganti password, tolak akses).

## 12. Poin terbuka

- Hosting: server RS (on-premise) atau cloud; menentukan detail deploy dan backup.
- Perlu SSO/LDAP RS atau cukup akun lokal.

## 13. Definition of Done

Lihat `00-overview.md` bagian 5, ditambah: staging dapat diakses, runbook rollback tertulis, backup otomatis aktif dan satu pemulihan diuji.
