---
trigger: model_decision
description: Arsitektur berlapis backend (controller, service, domain, repository), aturan dependensi antar lapisan dan modul, konvensi TypeScript/NestJS. Gunakan saat membuat atau mengubah kode di src/.
---
# Aturan arsitektur backend

Struktur folder lengkap: `docs/STRUCTURE.md`. Pola: **modul per domain**, di dalamnya **Controller -> Service -> Repository**, dengan **Domain** murni untuk aturan bisnis.

## 1. Lapisan dan tanggung jawab

| Lapisan | Folder | Boleh | Dilarang |
| --- | --- | --- | --- |
| Controller (HTTP) | `controllers/` | Routing, dekorator izin, menerima DTO, memanggil service, memetakan hasil ke DTO respons | Logika bisnis, SQL, memanggil repository |
| Service (aplikasi) | `services/` | Mengatur use case, membuka transaksi, memanggil repository dan domain, menulis audit/outbox | Mengakses `req`/`res`, menulis SQL |
| Domain | `domain/` | Entitas, value object, aturan bisnis murni (FEFO, status stok, konversi satuan) | I/O apa pun (DB, Redis, HTTP, waktu sistem langsung) |
| Repository | `repositories/` | SQL (Kysely) untuk tabel milik modul ini, pemetaan baris ke entitas | Aturan bisnis, memanggil service |
| DTO | `dto/` | Bentuk request/response, validasi masukan, dekorator OpenAPI | Logika |

Arah dependensi satu arah: `controller -> service -> (domain, repository)`. `domain` tidak mengimpor apa pun dari lapisan lain.

## 2. Aturan antar modul

- Modul hanya memanggil **service** modul lain yang diekspor eksplisit di `<domain>.module.ts`. **JANGAN** mengimpor repository modul lain atau membaca tabelnya.
- `stock` adalah satu-satunya modul yang menulis `stock_balances` dan `stock_movements` (lewat `PostingService`).
- Kode lintas modul yang netral (guard, filter, dekorator, util uang/waktu, paginasi) ada di `src/common/`. Akses teknis (pool DB, Redis, antrean, logger) ada di `src/infrastructure/`.
- Tidak ada impor melingkar antar modul; bila terjadi, ekstrak ke service ketiga atau gunakan event outbox.

## 3. Transaksi

- Service memulai transaksi lewat `UnitOfWork.run(async (tx) => { ... })`; repository menerima `tx` sebagai argumen. **JANGAN** membuka transaksi di controller atau repository.
- Transaksi pendek: tidak ada panggilan jaringan atau pekerjaan berat di dalamnya. Efek samping asinkron lewat `outbox_events` dalam transaksi yang sama.

## 4. Konvensi kode

- TypeScript `strict: true`; **JANGAN** `any` tanpa komentar alasan.
- Penamaan berkas: `receipt.controller.ts`, `receipt.service.ts`, `receipt.repository.ts`, `receipt.entity.ts`, `receipt.rules.ts` (domain), `create-receipt.dto.ts`, `*.spec.ts` untuk uji unit di `__tests__/`.
- Validasi masukan dengan DTO (`class-validator`); tolak field tak dikenal (`whitelist` + `forbidNonWhitelisted`). Respons dipetakan ke DTO; **JANGAN** membocorkan kolom internal seperti `password_hash`.
- OpenAPI dibuat dari dekorator (`@nestjs/swagger`); setiap endpoint punya `@ApiOperation`, skema respons, dan kemungkinan error.
- Izin lewat `@RequirePermission('stock.receipt.post')` + `LocationScopeGuard`. Endpoint tanpa dekorator izin ditolak oleh uji otomatis.
- Error: lempar `DomainError` (kode stabil bahasa Inggris, pesan pengguna Bahasa Indonesia); `HttpExceptionFilter` memetakan ke `application/problem+json`. **JANGAN** melempar `Error` generik ke klien.
- Waktu: simpan UTC; injeksikan `Clock`, **JANGAN** `new Date()` di domain/service yang perlu diuji.
- Uang/qty: `decimal.js`; serialisasi JSON sebagai string desimal. **JANGAN** `parseFloat`/`Number` untuk uang.
- Logging terstruktur (pino) dengan `request_id`; **JANGAN** mencatat password, token, atau isi dokumen penuh.
- Pekerjaan lama (ekspor, penutupan periode, impor besar) berjalan di worker (BullMQ), bukan di request HTTP.
- Library default dan alasannya: `docs/adr/0005-backend-stack.md`. Menambah dependensi baru butuh alasan di PR.

## 5. Menambah fitur: urutan kerja

1. Baca FR/AC di PRD fase. 2. Tulis aturan di `domain/` beserta uji unit. 3. Tulis repository dan uji integrasi. 4. Tulis service (transaksi, audit, outbox). 5. Tulis controller + DTO + izin. 6. `pnpm openapi:export`. Gunakan skill `add-module` / `add-endpoint`.
