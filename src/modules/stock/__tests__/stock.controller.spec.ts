import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StockController } from '../controllers/stock.controller';
import { StockQueryService } from '../services/stock-query.service';

describe('StockController', () => {
  let controller: StockController;
  let mockQueryService: any;

  beforeEach(() => {
    mockQueryService = {
      getStockBalances: vi.fn().mockResolvedValue([
        {
          item_id: '01934335-508b-7c30-97c7-578841443653',
          item_code: 'AA0096',
          item_name: 'Paracetamol',
          item_type: 'obat',
          location_id: '01934335-508b-7c30-97c7-578841443654',
          location_name: 'Gudang Farmasi Utama',
          quantity: '100.000',
          safety_stock: '20.000',
          min_stock: '50.000',
          status: 'aman',
          total_valuation: '500000.0000',
        },
      ]),
      getItemStockDetail: vi.fn().mockResolvedValue({
        item_id: '01934335-508b-7c30-97c7-578841443653',
        item_code: 'AA0096',
        item_name: 'Paracetamol',
        total_quantity: '100.000',
        total_valuation: '500000.0000',
        locations: [],
      }),
    };

    controller = new StockController(mockQueryService as StockQueryService);
  });

  const mockAdminUser: any = {
    id: 'user-admin',
    roles: [{ id: 'role-1', code: 'admin', location_id: null }],
    assigned_location_ids: [],
  };

  it('harus mengembalikan daftar saldo stok saat memanggil getStock', async () => {
    const result = await controller.getStock({}, mockAdminUser);
    expect(result).toHaveLength(1);
    expect(result[0].item_code).toBe('AA0096');
    expect(mockQueryService.getStockBalances).toHaveBeenCalledWith({}, mockAdminUser);
  });

  it('harus mengembalikan rincian stok item saat memanggil getItemStock', async () => {
    const result = await controller.getItemStock(
      '01934335-508b-7c30-97c7-578841443653',
      mockAdminUser,
    );
    expect(result.item_id).toBe('01934335-508b-7c30-97c7-578841443653');
    expect(mockQueryService.getItemStockDetail).toHaveBeenCalledWith(
      '01934335-508b-7c30-97c7-578841443653',
      mockAdminUser,
    );
  });
});
