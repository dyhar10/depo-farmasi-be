import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';
import { KYSELY } from '../../../infrastructure/database/database.service';
import { DatabaseTransaction } from '../../../infrastructure/database/unit-of-work';
import { generateUuidV7 } from '../../../common/utils/uuid';
import { BatchEntity, StockMovementEntity } from '../domain/stock.entity';

export interface BatchCreateInput {
  itemId: string;
  batchNumber: string;
  expiryDate?: Date | null;
  noExpiry?: boolean;
  unitCost: string;
  supplierId?: string | null;
  sourceType?: 'pembelian' | 'hibah' | 'program' | 'pinjaman' | 'btt' | 'legacy';
  isLegacy?: boolean;
  legacyPriceSeq?: number | null;
}

export interface LockedStockBalance {
  locationId: string;
  batchId: string;
  itemId: string;
  quantity: string;
  rowVersion: string | number | bigint;
}

@Injectable()
export class StockRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async findBatchByItemAndNumber(
    itemId: string,
    batchNumber: string,
    tx?: DatabaseTransaction,
  ): Promise<BatchEntity | null> {
    const executor = tx || this.db;
    const row = await executor
      .selectFrom('batches')
      .selectAll()
      .where('item_id', '=', itemId)
      .where('batch_number', '=', batchNumber)
      .executeTakeFirst();

    if (!row) return null;
    return {
      id: row.id,
      itemId: row.item_id,
      batchNumber: row.batch_number,
      expiryDate: row.expiry_date ? new Date(row.expiry_date) : null,
      noExpiry: row.no_expiry,
      unitCost: row.unit_cost.toString(),
      supplierId: row.supplier_id,
      sourceType: row.source_type,
      isLegacy: row.is_legacy,
      legacyPriceSeq: row.legacy_price_seq,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findOrCreateBatch(
    input: BatchCreateInput,
    tx?: DatabaseTransaction,
  ): Promise<BatchEntity> {
    const existing = await this.findBatchByItemAndNumber(input.itemId, input.batchNumber, tx);
    if (existing) {
      return existing;
    }

    const executor = tx || this.db;
    const batchId = generateUuidV7();
    const inserted = await executor
      .insertInto('batches')
      .values({
        id: batchId,
        item_id: input.itemId,
        batch_number: input.batchNumber,
        expiry_date: input.expiryDate || null,
        no_expiry: input.noExpiry ?? false,
        unit_cost: input.unitCost,
        supplier_id: input.supplierId || null,
        source_type: input.sourceType || (input.isLegacy ? 'legacy' : 'pembelian'),
        is_legacy: input.isLegacy ?? false,
        legacy_price_seq: input.legacyPriceSeq ?? null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: inserted.id,
      itemId: inserted.item_id,
      batchNumber: inserted.batch_number,
      expiryDate: inserted.expiry_date ? new Date(inserted.expiry_date) : null,
      noExpiry: inserted.no_expiry,
      unitCost: inserted.unit_cost.toString(),
      supplierId: inserted.supplier_id,
      sourceType: inserted.source_type,
      isLegacy: inserted.is_legacy,
      legacyPriceSeq: inserted.legacy_price_seq,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    };
  }

  /**
   * Mengunci baris saldo berurutan (location_id ASC, batch_id ASC) untuk menghindari deadlock.
   * Jika belum ada, baris dibuat dulu dengan saldo 0 via ON CONFLICT DO NOTHING.
   */
  async lockBalances(
    pairs: Array<{ locationId: string; batchId: string; itemId: string }>,
    tx: DatabaseTransaction,
  ): Promise<LockedStockBalance[]> {
    if (pairs.length === 0) return [];

    // Urutkan pasangan secara deterministik untuk mencegah deadlock
    const sortedPairs = [...pairs].sort((a, b) => {
      const locCmp = a.locationId.localeCompare(b.locationId);
      if (locCmp !== 0) return locCmp;
      return a.batchId.localeCompare(b.batchId);
    });

    // 1. Pastikan setiap baris saldo sudah ada (saldo awal 0)
    for (const p of sortedPairs) {
      await tx
        .insertInto('stock_balances')
        .values({
          location_id: p.locationId,
          batch_id: p.batchId,
          item_id: p.itemId,
          quantity: '0',
          row_version: '0',
          updated_at: new Date(),
        })
        .onConflict((oc) => oc.columns(['location_id', 'batch_id']).doNothing())
        .execute();
    }

    // 2. Kunci baris berurutan dengan SELECT ... FOR UPDATE
    const results: LockedStockBalance[] = [];
    for (const p of sortedPairs) {
      const row = await tx
        .selectFrom('stock_balances')
        .select(['location_id', 'batch_id', 'item_id', 'quantity', 'row_version'])
        .where('location_id', '=', p.locationId)
        .where('batch_id', '=', p.batchId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      results.push({
        locationId: row.location_id,
        batchId: row.batch_id,
        itemId: row.item_id,
        quantity: row.quantity.toString(),
        rowVersion: row.row_version,
      });
    }

    return results;
  }

  async insertMovements(
    movements: StockMovementEntity[],
    tx: DatabaseTransaction,
  ): Promise<void> {
    if (movements.length === 0) return;

    await tx
      .insertInto('stock_movements')
      .values(
        movements.map((m) => ({
          id: m.id,
          occurred_at: m.occurredAt,
          posted_at: m.postedAt,
          item_id: m.itemId,
          batch_id: m.batchId,
          location_id: m.locationId,
          counter_location_id: m.counterLocationId,
          movement_type: m.movementType,
          quantity: m.quantity,
          unit_cost: m.unitCost,
          document_type: m.documentType,
          document_id: m.documentId,
          document_line_id: m.documentLineId,
          reversal_of_id: m.reversalOfId,
          actor_id: m.actorId,
        })),
      )
      .execute();
  }

  async updateBalance(
    locationId: string,
    batchId: string,
    newQuantity: string,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await tx
      .updateTable('stock_balances')
      .set({
        quantity: newQuantity,
        row_version: sql`row_version + 1`,
        updated_at: new Date(),
      })
      .where('location_id', '=', locationId)
      .where('batch_id', '=', batchId)
      .execute();
  }

  async validateLocationsHoldStock(
    locationIds: string[],
    tx?: DatabaseTransaction,
  ): Promise<void> {
    if (locationIds.length === 0) return;
    const executor = tx || this.db;
    const locs = await executor
      .selectFrom('locations')
      .select(['id', 'name', 'holds_stock', 'is_active'])
      .where('id', 'in', locationIds)
      .execute();

    const locMap = new Map(locs.map((l) => [l.id, l]));
    for (const id of locationIds) {
      const loc = locMap.get(id);
      if (!loc) {
        throw new Error(`Lokasi dengan ID ${id} tidak ditemukan.`);
      }
      if (!loc.is_active) {
        throw new Error(`Lokasi ${loc.name} sedang tidak aktif.`);
      }
      if (!loc.holds_stock) {
        throw new Error(
          `Lokasi ${loc.name} tidak dapat menyimpan saldo stok (holds_stock = false).`,
        );
      }
    }
  }

  async validateItemsActive(
    itemIds: string[],
    tx?: DatabaseTransaction,
  ): Promise<void> {
    if (itemIds.length === 0) return;
    const executor = tx || this.db;
    const items = await executor
      .selectFrom('items')
      .select(['id', 'code', 'generic_name', 'is_active'])
      .where('id', 'in', itemIds)
      .execute();

    const itemMap = new Map(items.map((i) => [i.id, i]));
    for (const id of itemIds) {
      const item = itemMap.get(id);
      if (!item) {
        throw new Error(`Item dengan ID ${id} tidak ditemukan.`);
      }
      if (!item.is_active) {
        throw new Error(
          `Item ${item.code} - ${item.generic_name} sudah dinonaktifkan dan tidak dapat digunakan dalam transaksi baru.`,
        );
      }
    }
  }

  async findStockBalances(filter: {
    itemId?: string;
    locationId?: string;
    allowedLocationIds?: string[];
  }) {
    let query = this.db
      .selectFrom('stock_balances as sb')
      .innerJoin('items as i', 'i.id', 'sb.item_id')
      .innerJoin('locations as l', 'l.id', 'sb.location_id')
      .innerJoin('batches as b', 'b.id', 'sb.batch_id')
      .leftJoin('item_planning_params as ipp', 'ipp.item_id', 'i.id')
      .select([
        'sb.item_id',
        'i.code as item_code',
        'i.generic_name as item_name',
        'i.item_type',
        'sb.location_id',
        'l.name as location_name',
        'sb.batch_id',
        'b.batch_number',
        'b.expiry_date',
        'b.unit_cost',
        'b.is_legacy',
        'sb.quantity',
        sql<string>`COALESCE(ipp.safety_stock, 0)`.as('safety_stock'),
        sql<string>`COALESCE(ipp.min_stock, 0)`.as('min_stock'),
      ])
      .where('sb.quantity', '>', '0');

    if (filter.itemId) {
      query = query.where('sb.item_id', '=', filter.itemId);
    }
    if (filter.locationId) {
      query = query.where('sb.location_id', '=', filter.locationId);
    } else if (filter.allowedLocationIds) {
      if (filter.allowedLocationIds.length === 0) {
        return [];
      }
      query = query.where('sb.location_id', 'in', filter.allowedLocationIds);
    }

    return await query.orderBy('i.code', 'asc').orderBy('l.name', 'asc').execute();
  }

  async findBatchesByItem(itemId: string, allowedLocationIds?: string[]) {
    let query = this.db
      .selectFrom('stock_balances as sb')
      .innerJoin('locations as l', 'l.id', 'sb.location_id')
      .innerJoin('batches as b', 'b.id', 'sb.batch_id')
      .select([
        'sb.location_id',
        'l.code as location_code',
        'l.name as location_name',
        'sb.batch_id',
        'b.batch_number',
        'b.expiry_date',
        'b.unit_cost',
        'b.is_legacy',
        'sb.quantity',
      ])
      .where('sb.item_id', '=', itemId)
      .where('sb.quantity', '>', '0');

    if (allowedLocationIds) {
      if (allowedLocationIds.length === 0) {
        return [];
      }
      query = query.where('sb.location_id', 'in', allowedLocationIds);
    }

    return await query
      .orderBy('l.code', 'asc')
      .orderBy(sql`CASE WHEN b.is_legacy = true AND b.expiry_date IS NULL THEN 0 ELSE 1 END`, 'asc')
      .orderBy(sql`CASE WHEN b.expiry_date IS NOT NULL THEN b.expiry_date ELSE '9999-12-31'::date END`, 'asc')
      .orderBy('b.batch_number', 'asc')
      .execute();
  }

  /**
   * Menemukan batch yang memiliki saldo di suatu lokasi terurut berdasarkan aturan FEFO:
   * 1. Batch legacy tanpa ED lebih dulu (asumsi poin #14)
   * 2. ED terdekat dulu
   * 3. Batch dengan ED diketahui lebih dulu daripada batch non-legacy tanpa ED
   * 4. Nomor batch ASC
   */
  async findAvailableBatchesFefo(
    itemId: string,
    locationId: string,
    tx?: DatabaseTransaction,
  ) {
    const executor = tx || this.db;
    return await executor
      .selectFrom('stock_balances as sb')
      .innerJoin('batches as b', 'b.id', 'sb.batch_id')
      .select([
        'sb.batch_id',
        'b.batch_number',
        'b.expiry_date',
        'b.unit_cost',
        'b.is_legacy',
        'sb.quantity',
      ])
      .where('sb.item_id', '=', itemId)
      .where('sb.location_id', '=', locationId)
      .where('sb.quantity', '>', '0')
      .orderBy(sql`CASE WHEN b.is_legacy = true AND b.expiry_date IS NULL THEN 0 ELSE 1 END`, 'asc')
      .orderBy(sql`CASE WHEN b.expiry_date IS NOT NULL THEN b.expiry_date ELSE '9999-12-31'::date END`, 'asc')
      .orderBy('b.batch_number', 'asc')
      .execute();
  }

  /**
   * Menjumlahkan mutasi ledger untuk verifikasi integritas: ledger sum == balance
   */
  async getLedgerSum(batchId: string, locationId: string, tx?: DatabaseTransaction): Promise<string> {
    const executor = tx || this.db;
    const result = await executor
      .selectFrom('stock_movements')
      .select(sql<string>`COALESCE(SUM(quantity), 0)`.as('total'))
      .where('batch_id', '=', batchId)
      .where('location_id', '=', locationId)
      .executeTakeFirst();

    return result?.total?.toString() || '0';
  }

  /**
   * Mengambil saldo dari tabel stock_balances
   */
  async getBalance(batchId: string, locationId: string, tx?: DatabaseTransaction): Promise<string> {
    const executor = tx || this.db;
    const result = await executor
      .selectFrom('stock_balances')
      .select('quantity')
      .where('batch_id', '=', batchId)
      .where('location_id', '=', locationId)
      .executeTakeFirst();

    return result?.quantity?.toString() || '0';
  }
}
