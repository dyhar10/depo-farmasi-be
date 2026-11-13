---
name: add-endpoint
description: "Gunakan saat membuat endpoint REST baru: izin, validasi, audit, idempotensi, pengujian, dan pembaruan OpenAPI."
---
# Membuat endpoint baru

1. Rancang rute (`/api/v1/<sumber-daya>`), method, izin, bentuk request/response (DTO di `dto/`).
2. Dekorator: `@RequirePermission('...')`, `@UseGuards(LocationScopeGuard)` bila data terikat lokasi.
3. Validasi input; tolak field tak dikenal. Daftar: keyset pagination `{ data, next_cursor }`.
4. Service melempar `DomainError` (kode stabil); controller tidak menangkap error.
5. Tulis audit untuk aksi tulis. POST pengubah stok: dukung `Idempotency-Key`.
6. Uji: sukses, validasi gagal (400/422), tanpa izin (403), di luar lokasi (404), dan kasus batas.
7. Jalankan `pnpm openapi:export`; sebut perubahan kontrak di PR agar FE menyesuaikan.

**Selesai bila:** uji otomatis "semua endpoint punya izin" lulus dan p95 sesuai target fase.
