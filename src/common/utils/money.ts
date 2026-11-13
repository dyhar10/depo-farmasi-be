import Decimal from 'decimal.js';

// Configure Decimal.js precision for financial & quantity calculations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function toDecimal(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

export function formatMoney(value: string | Decimal): string {
  return new Decimal(value).toFixed(4);
}

export function formatQuantity(value: string | Decimal): string {
  return new Decimal(value).toFixed(3);
}

export { Decimal };

