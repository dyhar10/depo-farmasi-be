---
name: add-cached-data
description: "Gunakan saat menambah data statis yang di-cache di Redis: kunci, TTL, invalidasi lewat outbox, dan perilaku saat Redis mati."
---
# Menambah data statis ber-cache

1. Pastikan data memang jarang berubah dan sering dibaca (`.agents/rules/30-api-security.md`). Saldo stok dan transaksi **bukan** kandidat.
2. Pakai helper cache-aside:

```ts
async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  const hit = await redis.get(`v1:${key}`);
  if (hit) return JSON.parse(hit) as T;
  const value = await load();
  await redis.set(`v1:${key}`, JSON.stringify(value), 'EX', ttlSec);
  return value;
}
```

3. Kunci: `v1:<entitas>:<id>` atau `v1:<entitas>:list:<hash-filter>`. TTL: master 1 jam, hak akses 10 menit.
4. Invalidasi: saat entitas berubah, tulis `outbox_events` (dalam transaksi yang sama); worker menghapus kunci terkait. Naikkan versi namespace (`v2:`) bila format data berubah.
5. Tambahkan `ETag`/`Cache-Control` pada GET dan `staleTime` di TanStack Query.
6. Uji: cache hit, miss, invalidasi, dan perilaku saat Redis mati (harus turun ke DB).

**Selesai bila:** perubahan terlihat <= 5 detik di API dan data tidak basi lebih lama dari TTL browser.
