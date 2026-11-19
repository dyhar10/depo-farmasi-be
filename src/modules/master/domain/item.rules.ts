import Decimal from 'decimal.js';

export interface ItemPlanningParamsValidation {
  safety_stock: string | number | Decimal;
  min_stock: string | number | Decimal;
}

export class ItemDomainRules {
  /**
   * Normalizes item code: trims leading/trailing whitespace,
   * preserves exact casing and suffixes like "-B" (e.g. "CL0105-B").
   */
  static normalizeCode(code: string): string {
    return code.trim();
  }

  /**
   * Validates planning parameters: min_stock must be >= safety_stock.
   */
  static validatePlanningParams(params: ItemPlanningParamsValidation): boolean {
    const safety = new Decimal(params.safety_stock || 0);
    const min = new Decimal(params.min_stock || 0);

    if (safety.isNegative() || min.isNegative()) {
      return false;
    }

    return min.greaterThanOrEqualTo(safety);
  }

  /**
   * Checks if an item can be deactivated:
   * FR-1.13: Item yang punya stok (> 0) tidak dapat dinonaktifkan.
   */
  static canDeactivate(currentStockQuantity: string | number | Decimal): boolean {
    const qty = new Decimal(currentStockQuantity || 0);
    return qty.isZero() || qty.isNegative();
  }

  /**
   * Validates pack size: must be > 0.
   */
  static validatePackSize(packSize: string | number | Decimal): boolean {
    const size = new Decimal(packSize || 0);
    return size.greaterThan(0);
  }
}
