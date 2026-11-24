import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PostingService } from '../../src/modules/stock/services/posting.service';
import { StockRepository } from '../../src/modules/stock/repositories/stock.repository';
import { KYSELY } from '../../src/infrastructure/database/database.service';
import { Kysely } from 'kysely';
import { Database } from '../../src/infrastructure/database/kysely.types';
import { generateUuidV7 } from '../../src/common/utils/uuid';
import { Decimal } from 'decimal.js';

describe('Stock Concurrency Integration Test', () => {
  let app: TestingModule;
  let postingService: PostingService;
  let stockRepository: StockRepository;
  let db: Kysely<Database>;

  let testUserId: string;
  let testItemId: string;
  let testLocationId: string;
  let testBatchId: string;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    await app.init();

    postingService = app.get(PostingService);
    stockRepository = app.get(StockRepository);
    db = app.get(KYSELY);

    // 1. Dapatkan user admin
    const user = await db
      .selectFrom('users')
      .select('id')
      .where('username', '=', 'admin')
      .executeTakeFirst();
    testUserId = user?.id || generateUuidV7();

    // 2. Dapatkan atau buat unit dan kategori
    let unit = await db.selectFrom('units').select('id').executeTakeFirst();
    if (!unit) {
      unit = await db
        .insertInto('units')
        .values({
          id: generateUuidV7(),
          code: 'TAB',
          name: 'Tablet',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
    }

    let category = await db.selectFrom('item_categories').select('id').executeTakeFirst();
    if (!category) {
      category = await db
        .insertInto('item_categories')
        .values({
          id: generateUuidV7(),
          code: 'OBAT-TEST',
          name: 'Obat Test',
          level: 1,
          item_type: 'obat',
          parent_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
    }

    // 3. Buat lokasi uji
    const locCode = `LOC-${Date.now()}`;
    const loc = await db
      .insertInto('locations')
      .values({
        id: generateUuidV7(),
        code: locCode,
        name: `Lokasi Uji ${locCode}`,
        location_type: 'gudang',
        holds_stock: true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    testLocationId = loc.id;

    // 4. Buat item uji
    const itemCode = `ITEM-${Date.now()}`;
    const item = await db
      .insertInto('items')
      .values({
        id: generateUuidV7(),
        code: itemCode,
        generic_name: `Generic ${itemCode}`,
        item_type: 'obat',
        category_id: category.id,
        base_unit_id: unit.id,
        pack_size: 1,
        catalog_type: 'ekatalog',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    testItemId = item.id;

    // 5. Buat batch awal dengan saldo 100 via posting opening
    const batch = await stockRepository.findOrCreateBatch({
      itemId: testItemId,
      batchNumber: 'BATCH-CONCURRENCY-1',
      unitCost: '1000.0000',
      expiryDate: new Date('2027-12-31'),
    });
    testBatchId = batch.id;

    await postingService.post({
      documentType: 'import',
      documentId: generateUuidV7(),
      actorId: testUserId,
      lines: [
        {
          itemId: testItemId,
          batchId: testBatchId,
          locationId: testLocationId,
          movementType: 'opening',
          quantity: '100.000',
          unitCost: '1000.0000',
        },
      ],
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('tidak membuat saldo negatif pada posting pengeluaran paralel (20x10 dari saldo 100)', async () => {
    // Menjalankan 20 posting pengeluaran paralel (masing-masing qty 10)
    // Dengan saldo awal 100, tepat 10 harus berhasil dan 10 harus ditolak
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        postingService.post({
          documentType: 'issue',
          documentId: generateUuidV7(),
          actorId: testUserId,
          lines: [
            {
              itemId: testItemId,
              batchId: testBatchId,
              locationId: testLocationId,
              movementType: 'issue',
              quantity: '10.000',
              unitCost: '1000.0000',
              documentLineId: generateUuidV7(),
            },
          ],
        }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(10);
    expect(rejected).toHaveLength(10);

    // Verifikasi saldo akhir adalah 0
    const finalBalance = await stockRepository.getBalance(testBatchId, testLocationId);
    expect(new Decimal(finalBalance).toFixed(3)).toBe('0.000');

    // Verifikasi jumlah ledger mutasi = saldo akhir (100 masuk - 10 * 10 keluar = 0)
    const ledgerSum = await stockRepository.getLedgerSum(testBatchId, testLocationId);
    expect(new Decimal(ledgerSum).toFixed(3)).toBe('0.000');
  });

  it('tidak terjadi deadlock pada mutasi beberapa batch secara bersamaan', async () => {
    // Siapkan batch kedua dengan saldo 50
    const batch2 = await stockRepository.findOrCreateBatch({
      itemId: testItemId,
      batchNumber: 'BATCH-CONCURRENCY-2',
      unitCost: '2000.0000',
      expiryDate: new Date('2028-06-30'),
    });

    await postingService.post({
      documentType: 'import',
      documentId: generateUuidV7(),
      actorId: testUserId,
      lines: [
        {
          itemId: testItemId,
          batchId: batch2.id,
          locationId: testLocationId,
          movementType: 'opening',
          quantity: '50.000',
          unitCost: '2000.0000',
        },
      ],
    });

    // Jalankan transaksi paralel yang menyentuh kedua batch dalam urutan berlawanan
    const promises = Array.from({ length: 10 }, (_, idx) => {
      const isEven = idx % 2 === 0;
      const lines = isEven
        ? [
            {
              itemId: testItemId,
              batchId: testBatchId,
              locationId: testLocationId,
              movementType: 'adjustment_in' as const,
              quantity: '1.000',
              unitCost: '1000.0000',
            },
            {
              itemId: testItemId,
              batchId: batch2.id,
              locationId: testLocationId,
              movementType: 'adjustment_in' as const,
              quantity: '1.000',
              unitCost: '2000.0000',
            },
          ]
        : [
            {
              itemId: testItemId,
              batchId: batch2.id,
              locationId: testLocationId,
              movementType: 'adjustment_in' as const,
              quantity: '1.000',
              unitCost: '2000.0000',
            },
            {
              itemId: testItemId,
              batchId: testBatchId,
              locationId: testLocationId,
              movementType: 'adjustment_in' as const,
              quantity: '1.000',
              unitCost: '1000.0000',
            },
          ];

      return postingService.post({
        documentType: 'stock_adjustment',
        documentId: generateUuidV7(),
        actorId: testUserId,
        lines,
      });
    });

    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    // Semua harus berhasil tanpa ada yang terkena error deadlock
    expect(fulfilled).toHaveLength(10);
  });
});
