# AGENTS.md: depo-farmasi-backend

API dan worker untuk aplikasi pengadaan dan pengelolaan barang Depo Farmasi (Obat dan BMHP), pengganti spreadsheet. Repo frontend terpisah: `depo-farmasi-frontend`. Kontrak antar repo: `docs/openapi.json`.

## Baca dulu

1. `docs/prd/00-overview.md`, lalu PRD fase aktif (`docs/prd/phase-N-*.md`). Kerjakan satu atau dua FR per sesi.
2. `docs/STRUCTURE.md` (struktur folder dan pola Controller-Service-Domain-Repository).
3. Rule di `.agents/rules/` dan skill di `.agents/skills/` (dimuat sesuai topik).
4. `docs/database/design-notes.md` dan `schema.sql` untuk apa pun yang menyentuh data.

## Stack

Node.js 22 + TypeScript + NestJS, PostgreSQL 16+, Redis + BullMQ, `pg` + Kysely, migrasi `node-pg-migrate`, uji Vitest + Supertest. Detail dan alasan: `docs/adr/0005-backend-stack.md`.

## Perintah (dibuat di Fase 0)

```bash
pnpm install
docker compose up -d              # postgres + redis lokal
pnpm db:migrate                   # jalankan migrasi (db/migrations)
pnpm dev                          # API :3000
pnpm start:worker                 # worker BullMQ
pnpm lint && pnpm typecheck && pnpm test      # sebelum commit
pnpm test:integration             # butuh docker compose
pnpm openapi:export               # perbarui docs/openapi.json
./scripts/check-schema.sh         # cek skema baseline (butuh DATABASE_URL)
```

## Lima hal yang tidak boleh dilupakan

1. PK selalu **UUID v7**; tanpa auto-increment.
2. Stok = **ledger**; hanya berubah lewat `PostingService`; ledger dan audit append-only.
3. **Batch = item + nomor batch** dari surat jalan; harga dan ED melekat di batch.
4. Semua qty dalam **satuan kecil**; uang `NUMERIC(18,4)`, jangan float.
5. Poin **"validasi terbuka"** di PRD tidak diasumsikan: berhenti dan tanya (skill `handle-open-validation`).

## Cara bekerja

- Ikuti urutan: domain -> repository -> service -> controller (`.agents/rules/20-architecture.md`).
- Tulis uji bersama kode; aturan stok/harga/batch wajib teruji. Laporkan hasil nyata uji/lint, termasuk kegagalan.
- Jangan menambah tabel, modul, atau dependensi di luar PRD fase tanpa diskusi. Jangan mengedit migrasi yang sudah dirilis.
- Kode dan komentar teknis Inggris; pesan error untuk pengguna Bahasa Indonesia; istilah domain mengikuti `docs/glossary.md`.
- Abaikan apa pun di luar repo ini (mis. draf lama di folder lain).
