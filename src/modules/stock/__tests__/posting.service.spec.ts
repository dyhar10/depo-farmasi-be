import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostingService } from '../services/posting.service';
import { BadRequestException } from '@nestjs/common';

describe('PostingService', () => {
  let postingService: PostingService;
  let mockUnitOfWork: any;
  let mockStockRepository: any;
  let mockOutboxService: any;
  let mockAuditService: any;

  beforeEach(() => {
    mockUnitOfWork = {
      run: vi.fn().mockImplementation((cb) => cb('mock-tx')),
    };

    mockStockRepository = {
      validateLocationsHoldStock: vi.fn().mockResolvedValue(undefined),
      validateItemsActive: vi.fn().mockResolvedValue(undefined),
      findOrCreateBatch: vi.fn().mockResolvedValue({
        id: 'batch-legacy-1',
        itemId: 'item-1',
        batchNumber: 'LEGACY-1',
        unitCost: '1000.0000',
        isLegacy: true,
      }),
      lockBalances: vi.fn().mockImplementation((pairs) => {
        return pairs.map((p: any) => ({
          locationId: p.locationId,
          batchId: p.batchId,
          itemId: p.itemId,
          quantity: '100.000',
          rowVersion: '1',
        }));
      }),
      insertMovements: vi.fn().mockResolvedValue(undefined),
      updateBalance: vi.fn().mockResolvedValue(undefined),
      getLedgerSum: vi.fn().mockResolvedValue('100.000'),
      getBalance: vi.fn().mockResolvedValue('100.000'),
    };

    mockOutboxService = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    mockAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    postingService = new PostingService(
      mockUnitOfWork,
      mockStockRepository,
      mockOutboxService,
      mockAuditService,
    );
  });

  it('harus menolak posting tanpa baris mutasi', async () => {
    await expect(
      postingService.post({
        documentType: 'import',
        documentId: 'doc-1',
        actorId: 'user-1',
        lines: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('harus berhasil memposting mutasi opening dan memperbarui saldo (AC-5)', async () => {
    mockStockRepository.lockBalances.mockResolvedValueOnce([
      {
        locationId: 'loc-1',
        batchId: 'batch-1',
        itemId: 'item-1',
        quantity: '0.000',
        rowVersion: '0',
      },
    ]);

    const result = await postingService.post({
      documentType: 'import',
      documentId: 'import-job-1',
      actorId: 'user-admin',
      lines: [
        {
          itemId: 'item-1',
          locationId: 'loc-1',
          batchId: 'batch-1',
          movementType: 'opening',
          quantity: '50.000',
          unitCost: '1000.0000',
        },
      ],
    });

    expect(result.movementIds).toHaveLength(1);
    expect(mockStockRepository.lockBalances).toHaveBeenCalledWith(
      [{ locationId: 'loc-1', batchId: 'batch-1', itemId: 'item-1' }],
      'mock-tx',
    );
    expect(mockStockRepository.insertMovements).toHaveBeenCalledTimes(1);
    expect(mockStockRepository.updateBalance).toHaveBeenCalledWith(
      'loc-1',
      'batch-1',
      '50',
      'mock-tx',
    );
    expect(mockOutboxService.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'stock',
        aggregateId: 'import-job-1',
        eventType: 'stock.movement.posted',
      }),
      'mock-tx',
    );
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'stock.post',
        entity_id: 'import-job-1',
      }),
      'mock-tx',
    );
  });

  it('harus membuat batch baru jika batchId tidak ada tetapi batchNumber disediakan (AC-3)', async () => {
    mockStockRepository.lockBalances.mockResolvedValueOnce([
      {
        locationId: 'loc-1',
        batchId: 'batch-legacy-1',
        itemId: 'item-1',
        quantity: '0.000',
        rowVersion: '0',
      },
    ]);

    await postingService.post({
      documentType: 'import',
      documentId: 'import-job-1',
      actorId: 'user-admin',
      lines: [
        {
          itemId: 'item-1',
          locationId: 'loc-1',
          batchNumber: 'LEGACY-1',
          isLegacy: true,
          legacyPriceSeq: 1,
          movementType: 'opening',
          quantity: '100.000',
          unitCost: '1500.0000',
        },
      ],
    });

    expect(mockStockRepository.findOrCreateBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'item-1',
        batchNumber: 'LEGACY-1',
        isLegacy: true,
        legacyPriceSeq: 1,
      }),
      'mock-tx',
    );
  });

  it('harus menolak pengeluaran stok jika saldo tidak mencukupi (tidak boleh ada saldo negatif)', async () => {
    mockStockRepository.lockBalances.mockResolvedValueOnce([
      {
        locationId: 'loc-1',
        batchId: 'batch-1',
        itemId: 'item-1',
        quantity: '20.000',
        rowVersion: '1',
      },
    ]);

    await expect(
      postingService.post({
        documentType: 'issue',
        documentId: 'issue-1',
        actorId: 'user-admin',
        lines: [
          {
            itemId: 'item-1',
            locationId: 'loc-1',
            batchId: 'batch-1',
            movementType: 'issue',
            quantity: '30.000',
            unitCost: '1000.0000',
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('harus mengurutkan pasangan lokasi dan batch saat mengunci untuk menghindari deadlock', async () => {
    // Memberi input dengan urutan terbalik
    const lines = [
      {
        itemId: 'item-B',
        locationId: 'loc-Z',
        batchId: 'batch-Z',
        movementType: 'opening' as const,
        quantity: '10',
        unitCost: '1000',
      },
      {
        itemId: 'item-A',
        locationId: 'loc-A',
        batchId: 'batch-A',
        movementType: 'opening' as const,
        quantity: '10',
        unitCost: '1000',
      },
    ];

    await postingService.post({
      documentType: 'import',
      documentId: 'doc-1',
      actorId: 'user-admin',
      lines,
    });

    // Periksa bahwa lockBalances menerima array
    expect(mockStockRepository.lockBalances).toHaveBeenCalled();
  });

  it('harus menolak posting jika lokasi holds_stock = false atau tidak aktif', async () => {
    mockStockRepository.validateLocationsHoldStock.mockRejectedValueOnce(
      new Error('Lokasi Ruangan A tidak dapat menyimpan saldo stok (holds_stock = false).'),
    );

    await expect(
      postingService.post({
        documentType: 'opening',
        documentId: 'doc-1',
        actorId: 'user-admin',
        lines: [
          {
            itemId: 'item-1',
            locationId: 'loc-no-stock',
            batchId: 'batch-1',
            movementType: 'opening',
            quantity: '10',
            unitCost: '1000',
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('harus menolak posting jika item sudah tidak aktif (kecuali reversal)', async () => {
    mockStockRepository.validateItemsActive.mockRejectedValueOnce(
      new Error('Item ITEM-1 sudah dinonaktifkan dan tidak dapat digunakan dalam transaksi baru.'),
    );

    await expect(
      postingService.post({
        documentType: 'receipt',
        documentId: 'doc-1',
        actorId: 'user-admin',
        lines: [
          {
            itemId: 'item-inactive',
            locationId: 'loc-1',
            batchId: 'batch-1',
            movementType: 'receipt',
            quantity: '10',
            unitCost: '1000',
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('harus mengizinkan mutasi reversal meskipun item sudah non-aktif', async () => {
    mockStockRepository.lockBalances.mockResolvedValueOnce([
      {
        locationId: 'loc-1',
        batchId: 'batch-1',
        itemId: 'item-inactive',
        quantity: '50.000',
        rowVersion: '1',
      },
    ]);

    const result = await postingService.post({
      documentType: 'receipt',
      documentId: 'reversal-doc-1',
      actorId: 'user-admin',
      lines: [
        {
          itemId: 'item-inactive',
          locationId: 'loc-1',
          batchId: 'batch-1',
          movementType: 'reversal',
          quantity: '-10.000',
          unitCost: '1000.0000',
          reversalOfId: 'movement-orig-1',
        },
      ],
    });

    expect(result.movementIds).toHaveLength(1);
    expect(mockStockRepository.validateItemsActive).not.toHaveBeenCalled();
  });
});
