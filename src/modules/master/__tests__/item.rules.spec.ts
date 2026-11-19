import { describe, it, expect } from 'vitest';
import { ItemDomainRules } from '../domain/item.rules';

describe('ItemDomainRules', () => {
  describe('normalizeCode', () => {
    it('harus memangkas spasi depan dan belakang tanpa mengubah huruf besar/kecil atau akhiran khusus', () => {
      expect(ItemDomainRules.normalizeCode('  CL0105-B  ')).toBe('CL0105-B');
      expect(ItemDomainRules.normalizeCode('AA0096')).toBe('AA0096');
      expect(ItemDomainRules.normalizeCode('bk0001')).toBe('bk0001');
    });
  });

  describe('validatePlanningParams', () => {
    it('harus valid jika min_stock >= safety_stock', () => {
      expect(
        ItemDomainRules.validatePlanningParams({ safety_stock: 50, min_stock: 100 }),
      ).toBe(true);

      expect(
        ItemDomainRules.validatePlanningParams({ safety_stock: 50, min_stock: 50 }),
      ).toBe(true);
    });

    it('harus gagal jika min_stock < safety_stock (FR-1.5)', () => {
      expect(
        ItemDomainRules.validatePlanningParams({ safety_stock: 100, min_stock: 50 }),
      ).toBe(false);
    });

    it('harus gagal jika ada nilai negatif', () => {
      expect(
        ItemDomainRules.validatePlanningParams({ safety_stock: -10, min_stock: 50 }),
      ).toBe(false);
    });
  });

  describe('canDeactivate (FR-1.13 & AC-9)', () => {
    it('harus mengizinkan nonaktif jika saldo stok 0', () => {
      expect(ItemDomainRules.canDeactivate(0)).toBe(true);
      expect(ItemDomainRules.canDeactivate('0')).toBe(true);
    });

    it('harus menolak nonaktif jika saldo stok > 0 (AC-9)', () => {
      expect(ItemDomainRules.canDeactivate(10)).toBe(false);
      expect(ItemDomainRules.canDeactivate('15.5')).toBe(false);
    });
  });

  describe('validatePackSize', () => {
    it('harus valid jika pack_size > 0', () => {
      expect(ItemDomainRules.validatePackSize(1)).toBe(true);
      expect(ItemDomainRules.validatePackSize(100)).toBe(true);
    });

    it('harus tidak valid jika pack_size <= 0', () => {
      expect(ItemDomainRules.validatePackSize(0)).toBe(false);
      expect(ItemDomainRules.validatePackSize(-5)).toBe(false);
    });
  });
});
