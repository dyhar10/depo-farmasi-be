---
name: stock-concurrency-test
description: "Gunakan saat menulis uji konkurensi untuk posting stok: saldo tidak negatif dan tanpa deadlock."
---
# Menulis uji konkurensi stok

1. Siapkan DB uji bersih dengan satu item, satu batch, saldo 100 di satu lokasi.
2. Jalankan N posting pengeluaran paralel (mis. 20 x 10).
3. Harapan: tepat 10 berhasil, sisanya ditolak dengan galat saldo; saldo akhir 0; jumlah ledger = 100 keluar.
4. Pola:

```ts
it('tidak membuat saldo negatif pada posting paralel', async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () => postIssue({ batchId, quantity: '10' })),
  );
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(10);
  expect(await balanceOf(batchId, locationId)).toBe('0.000');
  expect(await ledgerSum(batchId, locationId)).toBe('0.000');
});
```

5. Ulangi untuk transfer dua sisi dan dua batch dalam urutan terbalik (uji deadlock).

**Selesai bila:** tidak ada deadlock dan tidak ada saldo negatif pada 100 putaran.
