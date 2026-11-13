---
name: release-rollback
description: "Gunakan saat merilis ke staging/produksi atau melakukan rollback: backup, migrasi, health check, postmortem."
---
# Rilis dan rollback

**Rilis**
1. Pastikan `main` hijau; ringkas perubahan (catatan rilis) dan cantumkan migrasi.
2. Backup otomatis berjalan sebelum migrasi produksi.
3. Buat tag `vX.Y.Z`; pipeline membangun image, menjalankan migrasi, lalu rolling update; menunggu persetujuan lingkungan produksi.
4. Cek `/health/ready`, jalankan smoke test (login, buka stok, posting uji di lokasi uji), pantau galat 15 menit.

**Rollback**
1. Kembalikan image ke tag sebelumnya (satu perintah di runbook).
2. Migrasi ditulis kompatibel mundur (expand/contract), sehingga versi lama tetap jalan di skema baru. **Jangan** rollback skema kecuali terpaksa dan terlatih.
3. Bila data rusak: pulihkan dari backup/PITR ke titik sebelum rilis di lingkungan terpisah, verifikasi, baru putuskan.
4. Tulis postmortem singkat (apa, dampak, penyebab, pencegahan).

**Selesai bila:** smoke test hijau di produksi dan runbook rollback pernah dilatih.
