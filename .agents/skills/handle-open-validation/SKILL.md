---
name: handle-open-validation
description: "Gunakan saat aturan bisnis tidak jelas atau PRD menandai poin validasi terbuka: berhenti, tanya, catat keputusan."
---
# Menangani poin validasi terbuka

**Kapan:** PRD menandai poin "perlu divalidasi" (#1-#17), atau aturan bisnis tidak jelas.

1. **Berhenti** mengkodekan bagian itu.
2. Tulis pertanyaan spesifik: konteks (kutip temuan di file), pilihan yang mungkin, dampak tiap pilihan.
3. Ajukan ke pemilik proses (apoteker penanggung jawab / staf gudang / perencana). Catat jawaban di PRD fase dan, bila memengaruhi desain, di ADR.
4. Sementara menunggu: kerjakan bagian lain atau jadikan aturan itu **konfigurasi** (bukan kode keras) dengan nilai awal yang jelas ditandai "sementara".
5. Setelah diputuskan: perbarui PRD, `.agents/rules/` (bila aturan umum), uji, lalu kodekan.

**Selesai bila:** keputusan tertulis dan tidak ada asumsi tersembunyi di kode.
