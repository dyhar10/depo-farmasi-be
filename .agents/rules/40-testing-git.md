---
trigger: model_decision
description: Aturan pengujian (unit, integrasi, konkurensi, kontrak), Git, review PR, dan CI untuk backend.
---
# Aturan pengujian, Git, dan CI

## 8. Pengujian

| Jenis | Alat | Cakupan wajib |
| --- | --- | --- |
| Unit | Vitest | Aturan domain murni: FEFO, status stok, konversi satuan, normalisasi, penomoran |
| Integrasi | Vitest + Postgres/Redis asli (service container) | PostingService, idempotensi, reversal, impor, view, izin per lokasi |
| Konkurensi | Vitest dengan transaksi paralel | Dua dan dua puluh posting paralel pada batch yang sama tidak membuat saldo negatif |
| Kontrak | Snapshot `docs/openapi.json` | Perubahan kontrak terlihat di diff PR dan diberitahukan ke repo frontend |
| API e2e | Supertest | Alur utama tiap fase lewat HTTP (login, penerimaan, pengeluaran, opname, PO) |
| Migrasi | skrip CI | Dari nol dan dari snapshot fase sebelumnya |

- Aturan baru di domain stok/harga/batch **WAJIB** disertai uji sebelum merge. Cakupan >= 70% pada logika domain.
- Fixture dari spreadsheet harus dianonimkan dan kecil (mis. 200 baris) dan disimpan di `test/fixtures/`.
- Uji tidak boleh bergantung pada waktu sistem atau urutan eksekusi; DB uji di-reset per suite.

## 9. Git, review, dan CI

- Branch dari `main`: `feat/<fase>-<ringkas>`, `fix/...`, `chore/...`. Commit mengikuti Conventional Commits (`feat(receipt): ...`).
- PR kecil dan fokus; deskripsi memuat rujukan FR/AC di PRD fase, dampak migrasi, dan cara uji. PR yang mengubah skema memuat migrasi dan pembaruan `docs/database/`.
- PR tidak dapat digabung bila CI merah. Reviewer memakai skill `review-pr`.
- `main` selalu dapat dirilis. Deploy ke staging otomatis; produksi lewat tag dan persetujuan.
