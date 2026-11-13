---
name: add-module
description: Gunakan saat membuat modul/domain backend baru (controller, service, repository, domain, dto) mengikuti struktur layered proyek.
---
# Menambah modul backend baru

**Kapan:** fitur baru butuh sumber daya sendiri (mis. `purchase-orders`).

1. Baca FR/AC di PRD fase aktif; tulis ulang sebagai daftar tugas kecil.
2. Buat `src/modules/<domain>/` dengan subfolder `controllers/`, `services/`, `repositories/`, `domain/`, `dto/`, `__tests__/` dan berkas `<domain>.module.ts` (lihat `docs/STRUCTURE.md`).
3. Definisikan DTO request/response di `dto/` (validasi masuk, pemetaan keluar).
4. Repository: hanya SQL (Kysely) untuk tabel modul ini. Service: aturan bisnis dan transaksi. Controller: dekorator izin, validasi, pemetaan DTO.
5. Daftarkan modul di `app.module.ts`; ekspor service hanya bila modul lain butuh.
6. Tambahkan izin baru ke `docs/database/seed.sql` dan pemetaan peran bila perlu (migrasi seed).
7. Tulis uji unit (service) dan integrasi (repository + DB asli).
8. Jalankan `pnpm openapi:export` agar `docs/openapi.json` terbarui; sebut perubahan kontrak di PR supaya repo frontend menyesuaikan.

**Selesai bila:** modul tidak membaca tabel modul lain langsung; semua endpoint punya izin; uji hijau.
