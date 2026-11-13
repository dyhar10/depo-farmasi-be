# ADR 0003: Modular monolith (backend) dengan frontend terpisah

**Status:** Diterima

## Konteks
Satu depo, tim kecil, skala data moderat, tetapi harus dapat tumbuh. Diinginkan full-stack JavaScript dengan FE dan BE dipisah.

## Keputusan
- Backend NestJS sebagai modular monolith (modul per domain, batas jelas, satu database).
- Frontend Vue 3 sebagai SPA terpisah, di-deploy sendiri; berada di **repositori terpisah** (`depo-farmasi-frontend`); kontrak lewat OpenAPI, tipe dan klien FE dibangkitkan dari `docs/openapi.json` milik backend.
- Worker memakai basis kode yang sama dengan API; antrean BullMQ di Redis.
- Microservice ditunda sampai ada kebutuhan terukur.

## Konsekuensi
- (+) Sederhana dioperasikan, transaksi ACID lintas modul, satu bahasa di seluruh lapisan.
- (+) Batas modul memungkinkan pemisahan kelak (mis. `reporting`).
- (-) Disiplin diperlukan agar modul tidak saling membaca tabel; dijaga aturan di `.agents/rules/` dan tinjauan PR.
