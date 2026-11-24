import { describe, it, expect } from 'vitest';
import { StockDomainRules, InsufficientStockError } from '../domain/stock.rules';

describe('StockDomainRules', () => {
  describe('toSignedQuantity', () => {
    it('harus menghasilkan kuantitas positif untuk tipe mutasi masuk (opening, receipt, transfer_in)', () => {
      expect(StockDomainRules.toSignedQuantity('opening', '10').toString()).toBe('10');
      expect(StockDomainRules.toSignedQuantity('opening', '-10').toString()).toBe('10');
      expect(StockDomainRules.toSignedQuantity('receipt', '50.5').toString()).toBe('50.5');
      expect(StockDomainRules.toSignedQuantity('transfer_in', '25').toString()).toBe('25');
    });

    it('harus menghasilkan kuantitas negatif untuk tipe mutasi keluar (issue, transfer_out, expired)', () => {
      expect(StockDomainRules.toSignedQuantity('issue', '10').toString()).toBe('-10');
      expect(StockDomainRules.toSignedQuantity('issue', '-10').toString()).toBe('-10');
      expect(StockDomainRules.toSignedQuantity('transfer_out', '15').toString()).toBe('-15');
      expect(StockDomainRules.toSignedQuantity('expired', '5').toString()).toBe('-5');
    });

    it('harus mempertahankan tanda kuantitas untuk reversal', () => {
      expect(StockDomainRules.toSignedQuantity('reversal', '10').toString()).toBe('10');
      expect(StockDomainRules.toSignedQuantity('reversal', '-10').toString()).toBe('-10');
    });

    it('harus melempar galat jika kuantitas bernilai 0', () => {
      expect(() => StockDomainRules.toSignedQuantity('receipt', '0')).toThrow(
        'Kuantitas mutasi stok tidak boleh nol',
      );
    });
  });

  describe('calculateNewBalance', () => {
    it('harus menambah saldo untuk mutasi positif', () => {
      const next = StockDomainRules.calculateNewBalance('100.000', '50.000');
      expect(next.toString()).toBe('150');
    });

    it('harus mengurangi saldo untuk mutasi negatif jika saldo mencukupi', () => {
      const next = StockDomainRules.calculateNewBalance('100.000', '-40.000');
      expect(next.toString()).toBe('60');
    });

    it('harus melempar InsufficientStockError jika mutasi menyebabkan saldo negatif', () => {
      expect(() =>
        StockDomainRules.calculateNewBalance('30.000', '-50.000', {
          itemId: 'item-1',
          locationId: 'loc-1',
        }),
      ).toThrow(InsufficientStockError);
    });
  });

  describe('determineStockStatus', () => {
    it('harus mengembalikan "cito" jika saldo <= 0', () => {
      expect(StockDomainRules.determineStockStatus('0', '10', '20')).toBe('cito');
      expect(StockDomainRules.determineStockStatus('-5', '10', '20')).toBe('cito');
    });

    it('harus mengembalikan "menipis_cito" jika saldo <= safety_stock', () => {
      expect(StockDomainRules.determineStockStatus('10', '10', '20')).toBe('menipis_cito');
      expect(StockDomainRules.determineStockStatus('8', '10', '20')).toBe('menipis_cito');
    });

    it('harus mengembalikan "menipis" jika saldo <= min_stock tetapi > safety_stock', () => {
      expect(StockDomainRules.determineStockStatus('15', '10', '20')).toBe('menipis');
      expect(StockDomainRules.determineStockStatus('20', '10', '20')).toBe('menipis');
    });

    it('harus mengembalikan "aman" jika saldo > min_stock', () => {
      expect(StockDomainRules.determineStockStatus('25', '10', '20')).toBe('aman');
    });
  });

  describe('calculateValuation', () => {
    it('harus menghitung nilai persediaan secara akurat tanpa floating point error', () => {
      const valuation = StockDomainRules.calculateValuation('100.333', '12500.5000');
      expect(valuation.toFixed(4)).toBe('1254212.6665');
    });
  });

  describe('generateLegacyBatchNumber', () => {
    it('harus menghasilkan format LEGACY-<seq>', () => {
      expect(StockDomainRules.generateLegacyBatchNumber(1)).toBe('LEGACY-1');
      expect(StockDomainRules.generateLegacyBatchNumber(2)).toBe('LEGACY-2');
    });
  });

  describe('compareBatchesFefo', () => {
    it('harus memprioritaskan batch legacy tanpa ED lebih dulu daripada batch dengan ED (asumsi poin #14)', () => {
      const legacyNoEd = { isLegacy: true, expiryDate: null, batchNumber: 'LEGACY-1' };
      const nonLegacyWithEd = { isLegacy: false, expiryDate: new Date('2026-12-31'), batchNumber: 'BATCH-001' };

      expect(StockDomainRules.compareBatchesFefo(legacyNoEd, nonLegacyWithEd)).toBeLessThan(0);
      expect(StockDomainRules.compareBatchesFefo(nonLegacyWithEd, legacyNoEd)).toBeGreaterThan(0);
    });

    it('harus memprioritaskan batch dengan ED paling awal (earliest expiry first)', () => {
      const edEarly = { isLegacy: false, expiryDate: new Date('2026-06-01'), batchNumber: 'BATCH-A' };
      const edLate = { isLegacy: false, expiryDate: new Date('2026-12-01'), batchNumber: 'BATCH-B' };

      expect(StockDomainRules.compareBatchesFefo(edEarly, edLate)).toBeLessThan(0);
      expect(StockDomainRules.compareBatchesFefo(edLate, edEarly)).toBeGreaterThan(0);
    });

    it('harus memprioritaskan batch dengan ED diketahui lebih dulu daripada batch non-legacy tanpa ED', () => {
      const withEd = { isLegacy: false, expiryDate: new Date('2027-01-01'), batchNumber: 'BATCH-A' };
      const withoutEd = { isLegacy: false, expiryDate: null, batchNumber: 'BATCH-B' };

      expect(StockDomainRules.compareBatchesFefo(withEd, withoutEd)).toBeLessThan(0);
      expect(StockDomainRules.compareBatchesFefo(withoutEd, withEd)).toBeGreaterThan(0);
    });

    it('harus mengurutkan berdasarkan nomor batch jika ED dan status legacy sama', () => {
      const batchA = { isLegacy: false, expiryDate: new Date('2026-12-31'), batchNumber: 'BATCH-10' };
      const batchB = { isLegacy: false, expiryDate: new Date('2026-12-31'), batchNumber: 'BATCH-20' };

      expect(StockDomainRules.compareBatchesFefo(batchA, batchB)).toBeLessThan(0);
      expect(StockDomainRules.compareBatchesFefo(batchB, batchA)).toBeGreaterThan(0);
    });
  });
});
