# ADR 0005: Library backend default

**Status:** Diterima (default awal; ubah lewat ADR baru)

## Konteks
Tim terbiasa dengan pola Controller-Service-Repository. Stok dan uang membutuhkan kontrol SQL yang eksplisit (kunci baris, urutan, `NUMERIC`), sementara CRUD master sederhana. Agent AI membutuhkan pilihan yang pasti agar tidak berganti library di tengah jalan.

## Keputusan
- **Framework:** NestJS (modul, DI, guard, interceptor) dengan TypeScript `strict`.
- **Akses data:** `pg` + Kysely (query builder bertipe) di lapisan repository; SQL eksplisit untuk posting stok.
- **Migrasi:** `node-pg-migrate` dengan berkas SQL di `db/migrations/` (mendukung `CREATE INDEX CONCURRENTLY`).
- **Validasi dan OpenAPI:** `class-validator` + `class-transformer` + `@nestjs/swagger`; kontrak diekspor ke `docs/openapi.json`.
- **Uang/qty:** `decimal.js`.
- **Antrean:** BullMQ di Redis. **Log:** pino. **Uji:** Vitest, Supertest, Postgres/Redis asli di CI.
- **ID:** `uuidv7` dibuat di aplikasi atau oleh `uuid_generate_v7()` di DB (ADR 0001).

## Konsekuensi
- (+) SQL jelas dan dapat ditinjau; tidak ada magic ORM pada jalur stok.
- (+) Struktur modul NestJS cocok dengan pola berlapis.
- (-) Pemetaan baris ke entitas ditulis manual di repository.
- Mengganti salah satu pilihan di atas membutuhkan ADR baru dan persetujuan.
