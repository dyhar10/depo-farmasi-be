import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StockQueryService } from '../services/stock-query.service';
import { StockRepository } from '../repositories/stock.repository';
import { UserSessionProfile } from '../../auth/domain/auth.domain';

describe('StockQueryService', () => {
  let service: StockQueryService;
  let mockStockRepository: any;

  beforeEach(() => {
    mockStockRepository = {
      findStockBalances: vi.fn(),
      findBatchesByItem: vi.fn(),
    };

    service = new StockQueryService(mockStockRepository as StockRepository);
  });

  const globalUser: UserSessionProfile = {
    id: 'user-admin',
    username: 'admin',
    email: 'admin@example.com',
    full_name: 'Administrator',
    must_change_password: false,
    roles: [{ id: 'role-1', code: 'admin', name: 'Admin', location_id: null }],
    permissions: ['stock.balance.read'],
    assigned_location_ids: [],
  };

  const restrictedUser: UserSessionProfile = {
    id: 'user-staff',
    username: 'staf1',
    email: 'staf@example.com',
    full_name: 'Staf Gudang',
    must_change_password: false,
    roles: [{ id: 'role-2', code: 'staf_gudang', name: 'Staf Gudang', location_id: 'loc-1' }],
    permissions: ['stock.balance.read'],
    assigned_location_ids: ['loc-1'],
  };

  const noLocationUser: UserSessionProfile = {
    id: 'user-no-loc',
    username: 'user_noloc',
    email: null,
    full_name: 'User No Loc',
    must_change_password: false,
    roles: [{ id: 'role-3', code: 'staf_depo', name: 'Staf Depo', location_id: 'loc-unassigned' }],
    permissions: ['stock.balance.read'],
    assigned_location_ids: [],
  };

  describe('getStockBalances', () => {
    it('harus mengembalikan saldo stok dengan kalkulasi status dan valuasi untuk user global', async () => {
      mockStockRepository.findStockBalances.mockResolvedValueOnce([
        {
          item_id: 'item-1',
          item_code: 'AA001',
          item_name: 'Amoxicillin 500mg',
          item_type: 'obat',
          location_id: 'loc-1',
          location_name: 'Gudang Utama',
          batch_id: 'batch-1',
          batch_number: 'B001',
          expiry_date: new Date('2026-12-31'),
          unit_cost: '500.0000',
          is_legacy: false,
          quantity: '100.000',
          safety_stock: '20.000',
          min_stock: '50.000',
        },
      ]);

      const result = await service.getStockBalances({}, globalUser);

      expect(result).toHaveLength(1);
      expect(result[0].item_code).toBe('AA001');
      expect(result[0].status).toBe('aman');
      expect(result[0].quantity).toBe('100.000');
      expect(result[0].total_valuation).toBe('50000.0000');
      expect(mockStockRepository.findStockBalances).toHaveBeenCalledWith({
        itemId: undefined,
        locationId: undefined,
        allowedLocationIds: undefined,
      });
    });

    it('harus membatasi allowedLocationIds untuk user dengan akses terbatas', async () => {
      mockStockRepository.findStockBalances.mockResolvedValueOnce([]);

      await service.getStockBalances({}, restrictedUser);

      expect(mockStockRepository.findStockBalances).toHaveBeenCalledWith({
        itemId: undefined,
        locationId: undefined,
        allowedLocationIds: ['loc-1'],
      });
    });

    it('harus langsung mengembalikan array kosong jika user terbatas tidak memiliki assigned_location_ids', async () => {
      const result = await service.getStockBalances({}, noLocationUser);

      expect(result).toEqual([]);
      expect(mockStockRepository.findStockBalances).not.toHaveBeenCalled();
    });
  });

  describe('getItemStockDetail', () => {
    it('harus mengembalikan rincian per lokasi dan batch', async () => {
      mockStockRepository.findBatchesByItem.mockResolvedValueOnce([
        {
          location_id: 'loc-1',
          location_code: 'GUD-01',
          location_name: 'Gudang Utama',
          batch_id: 'batch-1',
          batch_number: 'B001',
          expiry_date: '2026-12-31',
          unit_cost: '1000.0000',
          is_legacy: false,
          quantity: '50.000',
        },
        {
          location_id: 'loc-1',
          location_code: 'GUD-01',
          location_name: 'Gudang Utama',
          batch_id: 'batch-2',
          batch_number: 'LEGACY-1',
          expiry_date: null,
          unit_cost: '1200.0000',
          is_legacy: true,
          quantity: '30.000',
        },
      ]);

      const result = await service.getItemStockDetail('item-1', globalUser);

      expect(result.total_quantity).toBe('80.000');
      expect(result.total_valuation).toBe('86000.0000');
      expect(result.locations).toHaveLength(1);
      expect(result.locations[0].batches).toHaveLength(2);
      expect(result.locations[0].quantity).toBe('80.000');
    });

    it('harus mengembalikan struktur kosong jika item tidak memiliki stok', async () => {
      mockStockRepository.findBatchesByItem.mockResolvedValueOnce([]);

      const result = await service.getItemStockDetail('item-empty', globalUser);

      expect(result.item_id).toBe('item-empty');
      expect(result.total_quantity).toBe('0.000');
      expect(result.total_valuation).toBe('0.0000');
      expect(result.locations).toEqual([]);
    });
  });
});
