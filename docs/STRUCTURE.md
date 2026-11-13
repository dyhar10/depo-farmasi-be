# Struktur Folder Backend

Pola: **modul per domain** (Domain Pattern) dengan lapisan **Controller -> Service -> Repository** (Service Pattern) di dalam tiap modul. Folder kerangka sudah disediakan (berisi `.gitkeep`); Fase 0 mengisinya dengan kode.

## Pemetaan ke istilah yang familiar

| Anda terbiasa | Di proyek ini |
| --- | --- |
| MVC: Controller | `controllers/` |
| MVC: Model | `domain/` (entitas dan aturan) + `repositories/` (akses data) |
| MVC: View | DTO respons di `dto/` (JSON; tampilan ada di repo frontend) |
| Service Pattern | `services/` (use case dan transaksi) |
| Domain Pattern | `domain/` murni tanpa I/O, dikelompokkan per modul |

## Pohon

```
depo-farmasi-backend/
├── AGENTS.md                  # instruksi untuk Antigravity (selalu dimuat)
├── .agents/
│   ├── rules/                 # aturan proyek (00-core selalu aktif)
│   └── skills/                # prosedur kerja (add-module, add-migration, ...)
├── docs/
│   ├── prd/                   # PRD per fase (sumber utama)
│   ├── database/              # schema.sql, seed.sql, erd.md, design-notes.md
│   ├── adr/                   # keputusan arsitektur
│   ├── architecture.md, glossary.md, STRUCTURE.md
│   └── openapi.json           # kontrak untuk frontend (dibuat pnpm openapi:export)
├── src/
│   ├── main.ts                # bootstrap API
│   ├── worker.ts              # bootstrap worker (BullMQ)
│   ├── app.module.ts
│   ├── config/                # skema dan pembaca env
│   ├── common/                # guard, interceptor, filter, dekorator, util uang/waktu, paginasi
│   ├── infrastructure/        # pool DB + UnitOfWork, Redis, antrean, logger
│   └── modules/
│       └── <domain>/          # auth, users, audit, platform, master, imports, stock,
│           │                  # receiving, issuing, opname, planning, procurement, reporting
│           ├── <domain>.module.ts
│           ├── controllers/   # HTTP: routing, izin, DTO masuk/keluar
│           ├── services/      # use case, transaksi, audit, outbox
│           ├── domain/        # entitas + aturan bisnis murni (tanpa I/O)
│           ├── repositories/  # SQL (Kysely) untuk tabel modul
│           ├── dto/           # request/response + validasi + OpenAPI
│           └── __tests__/     # uji unit domain dan service
├── db/migrations/             # migrasi SQL (node-pg-migrate)
├── test/
│   ├── integration/           # Postgres + Redis asli (posting, konkurensi, impor)
│   ├── e2e/                   # Supertest alur utama
│   └── fixtures/              # data uji kecil dan teranonimkan
├── deploy/                    # compose, Caddyfile, deploy.sh, backup.sh
├── scripts/                   # check-schema.sh
└── .github/workflows/         # ci.yml, deploy.yml
```

## Aturan dependensi

```
controller -> service -> domain
                    \-> repository
```
- `domain` tidak mengimpor apa pun dari lapisan lain dan tidak melakukan I/O.
- Controller tidak memanggil repository; repository tidak berisi aturan bisnis.
- Antar modul hanya lewat **service** yang diekspor di `<domain>.module.ts`.
- `stock` satu-satunya modul yang menulis `stock_balances` dan `stock_movements`.

## Contoh alur: POST /api/v1/receipts/:id/post

1. `receiving/controllers/receipt.controller.ts`: cek izin `stock.receipt.post` dan lokasi, validasi `Idempotency-Key`, panggil service.
2. `receiving/services/receipt.service.ts`: `UnitOfWork.run` -> muat dokumen lewat repository -> `domain/receipt.rules.ts` (validasi ED, konversi satuan, peringatan harga) -> minta `stock/services/posting.service.ts` memposting mutasi -> ubah status dokumen -> tulis `outbox_events` dan `audit_logs`.
3. `stock/services/posting.service.ts`: kunci saldo berurutan, insert ledger, update saldo.
4. Controller memetakan hasil ke DTO respons.

## Di mana menaruh...

| Yang ingin dibuat | Letaknya |
| --- | --- |
| Aturan FEFO, status stok, konversi satuan | `modules/<domain>/domain/` |
| Query SQL | `modules/<domain>/repositories/` |
| Endpoint baru | `controllers/` + `dto/` (+ izin baru di `docs/database/seed.sql` via migrasi) |
| Guard, filter, util yang dipakai banyak modul | `src/common/` |
| Koneksi Redis/DB/antrean | `src/infrastructure/` |
| Job latar belakang | `modules/<domain>/services/` + pendaftaran di `worker.ts` |
| Migrasi skema | `db/migrations/` |
| Keputusan arsitektur baru | `docs/adr/` |

## Penamaan

`receipt.controller.ts`, `receipt.service.ts`, `receipt.repository.ts`, `receipt.entity.ts`, `receipt.rules.ts`, `create-receipt.dto.ts`, `receipt.rules.spec.ts`. Tabel database `snake_case` jamak; kelas `PascalCase`; berkas `kebab-case` atau `nama.lapisan.ts` seperti di atas.
