# depo-farmasi-backend

API, worker, database, dan deploy untuk aplikasi Depo Farmasi. Frontend ada di repo `depo-farmasi-frontend`.

## Isi repo

| Lokasi | Isi |
| --- | --- |
| `AGENTS.md`, `.agents/` | Instruksi, aturan, dan skill untuk Antigravity IDE |
| `docs/prd/` | PRD per fase (sumber utama; frontend menyalinnya) |
| `docs/STRUCTURE.md` | Struktur folder dan pola berlapis |
| `docs/database/` | `schema.sql`, `seed.sql`, ERD, catatan desain, pemetaan Excel |
| `docs/architecture.md`, `docs/adr/`, `docs/glossary.md` | Arsitektur, keputusan, istilah |
| `src/`, `db/migrations/`, `test/` | Kerangka folder kode (diisi mulai Fase 0) |
| `deploy/`, `.github/workflows/` | Compose, skrip deploy, CI/CD |

## Mulai dengan Antigravity

1. Buka folder ini sebagai workspace (root repo).
2. Pastikan `AGENTS.md` dan `.agents/rules/` terbaca: tanyakan agent "Sebutkan 5 aturan emas proyek ini".
3. Tugas pertama: Fase 0 di `docs/prd/phase-0-foundation.md` (FR-0.1 dulu: kerangka NestJS, `package.json`, Dockerfile, skrip pnpm di `AGENTS.md`).
4. Selalu minta implementation plan dulu, tinjau, baru setujui.

Rule selain `00-core.md` memakai `trigger: model_decision`. Bila ingin diaktifkan otomatis per folder, ubah ke `trigger: glob` dengan `globs` sesuai format di dokumentasi Antigravity.

## Pemeriksaan skema

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/db_kosong ./scripts/check-schema.sh
```
