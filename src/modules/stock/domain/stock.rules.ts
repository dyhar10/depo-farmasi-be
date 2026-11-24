import { Decimal } from 'decimal.js';

export type MovementType =
  | 'opening'
  | 'receipt'
  | 'issue'
  | 'transfer_in'
  | 'transfer_out'
  | 'return_in'
  | 'return_out'
  | 'expired'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'opname_in'
  | 'opname_out'
  | 'reversal';

export type StockStatus = 'cito' | 'menipis_cito' | 'menipis' | 'aman';

export class InsufficientStockError extends Error {
  constructor(
    public readonly itemId: string,
    public readonly locationId: string,
    public readonly currentBalance: string,
    public readonly requestedQty: string,
  ) {
    super(
      `Saldo stok tidak mencukupi untuk item ${itemId} di lokasi ${locationId}. Saldo saat ini: ${currentBalance}, dibutuhkan: ${requestedQty}`,
    );
    this.name = 'InsufficientStockError';
  }
}

export class StockDomainRules {
  private static readonly POSITIVE_TYPES = new Set<MovementType>([
    'opening',
    'receipt',
    'transfer_in',
    'return_in',
    'adjustment_in',
    'opname_in',
  ]);

  private static readonly NEGATIVE_TYPES = new Set<MovementType>([
    'issue',
    'transfer_out',
    'return_out',
    'expired',
    'adjustment_out',
    'opname_out',
  ]);

  /**
   * Mengubah kuantitas masukan menjadi kuantitas bertanda (signed) sesuai aturan movement_type di database:
   * Masuk (opening, receipt, dst) = positif (> 0)
   * Keluar (issue, transfer_out, dst) = negatif (< 0)
   * Reversal = sesuai tanda yang diberikan (<> 0)
   */
  static toSignedQuantity(movementType: MovementType, quantityInput: string | Decimal): Decimal {
    const qty = new Decimal(quantityInput);
    if (qty.isZero()) {
      throw new Error(`Kuantitas mutasi stok tidak boleh nol`);
    }

    if (this.POSITIVE_TYPES.has(movementType)) {
      return qty.abs();
    }

    if (this.NEGATIVE_TYPES.has(movementType)) {
      return qty.abs().negated();
    }

    if (movementType === 'reversal') {
      return qty;
    }

    throw new Error(`Tipe mutasi tidak dikenal: ${movementType}`);
  }

  /**
   * Menghitung saldo baru dan memastikan saldo tidak menjadi negatif.
   */
  static calculateNewBalance(
    currentBalanceInput: string | Decimal,
    movementQtyInput: string | Decimal,
    context?: { itemId: string; locationId: string },
  ): Decimal {
    const current = new Decimal(currentBalanceInput);
    const movement = new Decimal(movementQtyInput);
    const next = current.plus(movement);

    if (next.isNegative()) {
      throw new InsufficientStockError(
        context?.itemId || 'unknown',
        context?.locationId || 'unknown',
        current.toString(),
        movement.abs().toString(),
      );
    }

    return next;
  }

  /**
   * Menentukan status ketersediaan stok sesuai formula PRD dan view database:
   * 0: cito
   * <= safety_stock: menipis_cito
   * <= min_stock: menipis
   * selain itu: aman
   */
  static determineStockStatus(
    quantityInput: string | Decimal,
    safetyStockInput: string | Decimal,
    minStockInput: string | Decimal,
  ): StockStatus {
    const qty = new Decimal(quantityInput);
    const safety = new Decimal(safetyStockInput);
    const min = new Decimal(minStockInput);

    if (qty.lte(0)) {
      return 'cito';
    }
    if (qty.lte(safety)) {
      return 'menipis_cito';
    }
    if (qty.lte(min)) {
      return 'menipis';
    }
    return 'aman';
  }

  /**
   * Menghitung nilai persediaan: qty * unit_cost
   */
  static calculateValuation(
    quantityInput: string | Decimal,
    unitCostInput: string | Decimal,
  ): Decimal {
    const qty = new Decimal(quantityInput);
    const cost = new Decimal(unitCostInput);
    return qty.times(cost);
  }

  /**
   * Menghasilkan nomor batch migrasi spreadsheet (legacy): LEGACY-<seq>
   */
  static generateLegacyBatchNumber(seq: number): string {
    return `LEGACY-${seq}`;
  }

  /**
   * Mengurutkan batch berdasarkan aturan FEFO:
   * 1. Batch legacy tanpa ED lebih dulu (asumsi poin #14)
   * 2. ED terdekat dulu (earliest expiry first)
   * 3. Batch dengan ED diketahui lebih dulu daripada batch non-legacy tanpa ED
   * 4. Jika ED sama, urutkan berdasarkan batch_number
   */
  static compareBatchesFefo(
    a: { isLegacy?: boolean; expiryDate?: Date | string | null; batchNumber: string },
    b: { isLegacy?: boolean; expiryDate?: Date | string | null; batchNumber: string },
  ): number {
    const aLegacyNoEd = Boolean(a.isLegacy && !a.expiryDate);
    const bLegacyNoEd = Boolean(b.isLegacy && !b.expiryDate);

    if (aLegacyNoEd && !bLegacyNoEd) return -1;
    if (!aLegacyNoEd && bLegacyNoEd) return 1;

    const aTime = a.expiryDate ? new Date(a.expiryDate).getTime() : null;
    const bTime = b.expiryDate ? new Date(b.expiryDate).getTime() : null;

    if (aTime !== null && bTime !== null) {
      if (aTime !== bTime) return aTime - bTime;
    } else if (aTime !== null && bTime === null) {
      return -1;
    } else if (aTime === null && bTime !== null) {
      return 1;
    }

    return a.batchNumber.localeCompare(b.batchNumber);
  }
}
