import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MasterService } from '../services/master.service';
import { ItemRepository } from '../repositories/item.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { ReferenceRepository } from '../repositories/reference.repository';
import { SupplierRepository } from '../repositories/supplier.repository';
import { LocationRepository } from '../repositories/location.repository';
import { AuditService } from '../../audit/services/audit.service';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('MasterService', () => {
  let service: MasterService;
  let itemRepo: any;
  let categoryRepo: any;
  let referenceRepo: any;
  let supplierRepo: any;
  let locationRepo: any;
  let auditService: any;

  beforeEach(() => {
    itemRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByCode: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      getItemTotalStock: vi.fn(),
      upsertPlanningParams: vi.fn(),
    };

    categoryRepo = {
      findById: vi.fn(),
      findByCode: vi.fn(),
      create: vi.fn(),
    };

    referenceRepo = {
      findUnitById: vi.fn(),
    };

    supplierRepo = {};
    locationRepo = {};

    auditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    service = new MasterService(
      itemRepo as ItemRepository,
      categoryRepo as CategoryRepository,
      referenceRepo as ReferenceRepository,
      supplierRepo as SupplierRepository,
      locationRepo as LocationRepository,
      auditService as AuditService,
    );
  });

  describe('createItem', () => {
    it('harus menolak pembuatan item jika kode sudah terdaftar (AC-4)', async () => {
      itemRepo.findByCode.mockResolvedValue({ id: 'existing-id', code: 'CL0105' });

      await expect(
        service.createItem(
          {
            code: 'CL0105',
            item_type: 'obat',
            category_id: 'cat-id',
            generic_name: 'Paracetamol',
            base_unit_id: 'unit-id',
          },
          { actorId: 'user-id' },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('harus berhasil membuat item jika kode baru dan referensi valid', async () => {
      itemRepo.findByCode.mockResolvedValue(null);
      categoryRepo.findById.mockResolvedValue({ id: 'cat-id' });
      referenceRepo.findUnitById.mockResolvedValue({ id: 'unit-id' });
      itemRepo.create.mockResolvedValue({
        id: 'new-item-id',
        code: 'CL0105',
        generic_name: 'Paracetamol',
      });

      const res = await service.createItem(
        {
          code: 'CL0105',
          item_type: 'obat',
          category_id: 'cat-id',
          generic_name: 'Paracetamol',
          base_unit_id: 'unit-id',
        },
        { actorId: 'user-id' },
      );

      expect(res.id).toBe('new-item-id');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', entity_type: 'items' }),
      );
    });
  });

  describe('updateItem & nonaktif (AC-9 & FR-1.13)', () => {
    it('harus menolak nonaktif jika item masih memiliki saldo stok > 0', async () => {
      itemRepo.findById.mockResolvedValue({ id: 'item-1', is_active: true });
      itemRepo.getItemTotalStock.mockResolvedValue('150.000');

      await expect(
        service.updateItem('item-1', { is_active: false }, { actorId: 'user-id' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('harus mengizinkan nonaktif jika item memiliki saldo stok 0', async () => {
      itemRepo.findById.mockResolvedValue({ id: 'item-1', is_active: true });
      itemRepo.getItemTotalStock.mockResolvedValue('0');
      itemRepo.update.mockResolvedValue({ id: 'item-1', is_active: false });

      const res = await service.updateItem(
        'item-1',
        { is_active: false },
        { actorId: 'user-id' },
      );

      expect(res.is_active).toBe(false);
      expect(auditService.log).toHaveBeenCalled();
    });
  });

  describe('updatePlanningParams (FR-1.5)', () => {
    it('harus menolak update jika min_stock < safety_stock', async () => {
      itemRepo.findById.mockResolvedValue({ id: 'item-1' });

      await expect(
        service.updatePlanningParams(
          'item-1',
          { safety_stock: 100, min_stock: 50 },
          { actorId: 'user-id' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('harus berhasil jika min_stock >= safety_stock', async () => {
      itemRepo.findById.mockResolvedValue({ id: 'item-1' });
      itemRepo.upsertPlanningParams.mockResolvedValue(undefined);

      const res = await service.updatePlanningParams(
        'item-1',
        { safety_stock: 50, min_stock: 100 },
        { actorId: 'user-id' },
      );

      expect(res.message).toBeDefined();
      expect(itemRepo.upsertPlanningParams).toHaveBeenCalled();
    });
  });
});
