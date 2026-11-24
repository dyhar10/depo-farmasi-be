import { describe, it, expect } from 'vitest';
import { ImportNormalizer } from '../domain/import-normalizer';

describe('ImportNormalizer', () => {
  describe('normalizeText', () => {
    it('harus memangkas spasi di awal dan akhir string', () => {
      expect(ImportNormalizer.normalizeText('   Paracetamol 500mg   ')).toBe('Paracetamol 500mg');
    });

    it('harus mengubah nilai #N/A, N/A, -, null, atau string kosong menjadi null (FR-1.7)', () => {
      expect(ImportNormalizer.normalizeText('#N/A')).toBeNull();
      expect(ImportNormalizer.normalizeText('#n/a')).toBeNull();
      expect(ImportNormalizer.normalizeText('N/A')).toBeNull();
      expect(ImportNormalizer.normalizeText('-')).toBeNull();
      expect(ImportNormalizer.normalizeText('')).toBeNull();
      expect(ImportNormalizer.normalizeText('   ')).toBeNull();
      expect(ImportNormalizer.normalizeText(null)).toBeNull();
      expect(ImportNormalizer.normalizeText(undefined)).toBeNull();
    });
  });

  describe('normalizeCode', () => {
    it('harus memangkas spasi tetapi mempertahankan huruf besar-kecil dan akhiran "-B"', () => {
      expect(ImportNormalizer.normalizeCode('  CL0105-B  ')).toBe('CL0105-B');
      expect(ImportNormalizer.normalizeCode('AA0096')).toBe('AA0096');
      expect(ImportNormalizer.normalizeCode('bk0001')).toBe('bk0001');
    });
  });

  describe('normalizeCatalogType', () => {
    it('harus menyeragamkan variasi "Non Ekatalog" menjadi "non_ekatalog" (AC-6)', () => {
      expect(ImportNormalizer.normalizeCatalogType('Non Ekatalog')).toBe('non_ekatalog');
      expect(ImportNormalizer.normalizeCatalogType('Non ekatalog')).toBe('non_ekatalog');
      expect(ImportNormalizer.normalizeCatalogType('NON EKATALOG')).toBe('non_ekatalog');
      expect(ImportNormalizer.normalizeCatalogType('Non-Ekatalog')).toBe('non_ekatalog');
    });

    it('harus mengembalikan "ekatalog" untuk nilai umum atau e-katalog', () => {
      expect(ImportNormalizer.normalizeCatalogType('Ekatalog')).toBe('ekatalog');
      expect(ImportNormalizer.normalizeCatalogType('E-Katalog')).toBe('ekatalog');
      expect(ImportNormalizer.normalizeCatalogType('')).toBe('ekatalog');
    });
  });

  describe('normalizeDecimal', () => {
    it('harus menangani format angka lokal Indonesia dengan titik ribuan dan koma desimal', () => {
      expect(ImportNormalizer.normalizeDecimal('1.500,50')).toBe('1500.5');
      expect(ImportNormalizer.normalizeDecimal('10.000,00')).toBe('10000');
    });

    it('harus menangani format angka standar dengan koma ribuan atau titik desimal', () => {
      expect(ImportNormalizer.normalizeDecimal('1,500.50')).toBe('1500.5');
      expect(ImportNormalizer.normalizeDecimal('125.75')).toBe('125.75');
    });

    it('harus menangani tipe data number murni', () => {
      expect(ImportNormalizer.normalizeDecimal(1500.5)).toBe('1500.5');
      expect(ImportNormalizer.normalizeDecimal(0)).toBe('0');
    });

    it('harus mengembalikan null untuk nilai non-angka atau #N/A', () => {
      expect(ImportNormalizer.normalizeDecimal('#N/A')).toBeNull();
      expect(ImportNormalizer.normalizeDecimal('-')).toBeNull();
      expect(ImportNormalizer.normalizeDecimal('abc')).toBeNull();
    });
  });
});
