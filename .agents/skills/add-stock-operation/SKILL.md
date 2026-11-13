---
name: add-stock-operation
description: Gunakan saat menambah dokumen atau jenis mutasi yang mengubah stok melalui PostingService (penerimaan, pengeluaran, retur, penyesuaian, opname).
---
# Menambah operasi yang mengubah stok (dokumen baru / jenis mutasi)

**Kapan:** penerimaan, pengeluaran, retur, penyesuaian, atau jenis baru.

1. Tentukan arah mutasi dan `movement_type`. Bila jenis baru, tambahkan ke `CHECK` pada `stock_movements` (migrasi S2) dan ke aturan tanda.
2. Dokumen: header + baris, status `draft -> posted -> cancelled`, nomor dari `document_counters`.
3. Pembuatan draf **tidak** mengubah stok. Hanya `post` yang memanggil `PostingService`.
4. Kontrak PostingService (pola):

```ts
interface PostingLine {
  itemId: string; batchId: string; locationId: string;
  counterLocationId?: string;
  movementType: MovementType;
  quantity: Decimal;      // bertanda, satuan kecil
  unitCost: Decimal;      // snapshot dari batch
  documentLineId?: string;
}

interface PostingService {
  post(tx: Tx, input: {
    documentType: string; documentId: string; occurredAt: Date;
    actorId: string; lines: PostingLine[];
  }): Promise<void>;
}
```

5. Di dalam `post()`: urutkan (location, batch) -> `INSERT ... ON CONFLICT DO NOTHING` baris saldo -> `SELECT ... FOR UPDATE` -> validasi saldo -> insert mutasi -> update saldo -> tulis `outbox_events` -> `audit_logs`.
6. Endpoint `POST /.../:id/post` menerima `Idempotency-Key` dan dibungkus satu transaksi.
7. Pembatalan: buat mutasi `reversal` yang menunjuk `reversal_of_id`; tolak bila stok batch sudah terpakai.
8. Tulis uji S8 (konkurensi) dan uji idempotensi.

**Selesai bila:** tidak ada tulis ke `stock_balances` di luar PostingService; saldo = jumlah ledger pada uji; posting ulang tidak menggandakan efek.
