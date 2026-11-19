import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../audit/services/audit.service';
import { ItemDomainRules } from '../domain/item.rules';
import {
  CreateItemDto,
  ItemQueryDto,
  UpdateItemDto,
  UpdatePlanningParamsDto,
} from '../dto/item.dto';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/category.dto';
import {
  CreateDosageFormDto,
  CreateUnitDto,
  UpdateDosageFormDto,
  UpdateUnitDto,
} from '../dto/reference.dto';
import { CreateSupplierDto, UpdateSupplierDto } from '../dto/supplier.dto';
import { CreateLocationDto, UpdateLocationDto } from '../dto/location.dto';
import { ItemRepository } from '../repositories/item.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { ReferenceRepository } from '../repositories/reference.repository';
import { SupplierRepository } from '../repositories/supplier.repository';
import { LocationRepository } from '../repositories/location.repository';

@Injectable()
export class MasterService {
  constructor(
    private readonly itemRepository: ItemRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly referenceRepository: ReferenceRepository,
    private readonly supplierRepository: SupplierRepository,
    private readonly locationRepository: LocationRepository,
    private readonly auditService: AuditService,
  ) {}

  // ==========================================================================
  // Items (FR-1.1, FR-1.5, FR-1.10, FR-1.13)
  // ==========================================================================

  async listItems(query: ItemQueryDto) {
    return await this.itemRepository.findAll(query);
  }

  async getItem(id: string) {
    const item = await this.itemRepository.findById(id);
    if (!item) {
      throw new NotFoundException('Item tidak ditemukan.');
    }
    const currentStock = await this.itemRepository.getItemTotalStock(id);
    return {
      ...item,
      current_stock: currentStock,
    };
  }

  async createItem(
    dto: CreateItemDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const normalizedCode = ItemDomainRules.normalizeCode(dto.code);

    const existing = await this.itemRepository.findByCode(normalizedCode);
    if (existing) {
      throw new ConflictException({
        code: 'ITEM_CODE_ALREADY_EXISTS',
        message: `Item dengan kode "${normalizedCode}" sudah terdaftar.`,
      });
    }

    if (dto.pack_size && !ItemDomainRules.validatePackSize(dto.pack_size)) {
      throw new BadRequestException({
        code: 'INVALID_PACK_SIZE',
        message: 'Isi kemasan (pack_size) harus lebih besar dari 0.',
      });
    }

    const category = await this.categoryRepository.findById(dto.category_id);
    if (!category) {
      throw new BadRequestException('Kategori yang dipilih tidak valid.');
    }

    const baseUnit = await this.referenceRepository.findUnitById(dto.base_unit_id);
    if (!baseUnit) {
      throw new BadRequestException('Satuan dasar (base unit) tidak valid.');
    }

    const created = await this.itemRepository.create({
      ...dto,
      code: normalizedCode,
      created_by: meta.actorId,
    });

    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'create',
      entity_type: 'items',
      entity_id: created.id,
      new_values: { code: created.code, generic_name: created.generic_name },
      request_id: meta.requestId,
      ip: meta.ip,
    });

    return created;
  }

  async updateItem(
    id: string,
    dto: UpdateItemDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const item = await this.itemRepository.findById(id);
    if (!item) {
      throw new NotFoundException('Item tidak ditemukan.');
    }

    if (dto.pack_size && !ItemDomainRules.validatePackSize(dto.pack_size)) {
      throw new BadRequestException({
        code: 'INVALID_PACK_SIZE',
        message: 'Isi kemasan (pack_size) harus lebih besar dari 0.',
      });
    }

    // FR-1.13: Item yang punya stok tidak dapat dinonaktifkan
    if (dto.is_active === false && item.is_active) {
      const stock = await this.itemRepository.getItemTotalStock(id);
      if (!ItemDomainRules.canDeactivate(stock)) {
        throw new ForbiddenException({
          code: 'CANNOT_DEACTIVATE_ITEM_WITH_STOCK',
          message: `Item tidak dapat dinonaktifkan karena masih memiliki saldo stok (${stock}).`,
        });
      }
    }

    const updated = await this.itemRepository.update(id, dto);

    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'update',
      entity_type: 'items',
      entity_id: id,
      old_values: { is_active: item.is_active, generic_name: item.generic_name },
      new_values: { is_active: updated.is_active, generic_name: updated.generic_name },
      request_id: meta.requestId,
      ip: meta.ip,
    });

    return updated;
  }

  async updatePlanningParams(
    id: string,
    dto: UpdatePlanningParamsDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const item = await this.itemRepository.findById(id);
    if (!item) {
      throw new NotFoundException('Item tidak ditemukan.');
    }

    // FR-1.5: Validasi minimum >= safety
    if (!ItemDomainRules.validatePlanningParams(dto)) {
      throw new BadRequestException({
        code: 'INVALID_PLANNING_PARAMS',
        message: 'Nilai minimum stock harus lebih besar atau sama dengan safety stock.',
      });
    }

    await this.itemRepository.upsertPlanningParams(id, dto, meta.actorId);

    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'update_planning_params',
      entity_type: 'items',
      entity_id: id,
      new_values: dto,
      request_id: meta.requestId,
      ip: meta.ip,
    });

    return { message: 'Parameter perencanaan berhasil diperbarui.' };
  }

  // ==========================================================================
  // Categories (FR-1.2)
  // ==========================================================================

  async listCategories() {
    return await this.categoryRepository.findAll();
  }

  async createCategory(
    dto: CreateCategoryDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const existing = await this.categoryRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictException({
        code: 'CATEGORY_CODE_ALREADY_EXISTS',
        message: `Kategori dengan kode "${dto.code}" sudah ada.`,
      });
    }

    const created = await this.categoryRepository.create(dto);

    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'create',
      entity_type: 'item_categories',
      entity_id: created.id,
      new_values: { code: created.code, name: created.name },
      request_id: meta.requestId,
      ip: meta.ip,
    });

    return created;
  }

  async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan.');
    }

    const updated = await this.categoryRepository.update(id, dto);

    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'update',
      entity_type: 'item_categories',
      entity_id: id,
      new_values: dto,
      request_id: meta.requestId,
      ip: meta.ip,
    });

    return updated;
  }

  // ==========================================================================
  // Reference: Units & Dosage Forms (FR-1.2)
  // ==========================================================================

  async listUnits() {
    return await this.referenceRepository.findAllUnits();
  }

  async createUnit(
    dto: CreateUnitDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const existing = await this.referenceRepository.findUnitByCode(dto.code.trim().toUpperCase());
    if (existing) {
      throw new ConflictException(`Satuan dengan kode "${dto.code}" sudah ada.`);
    }
    const created = await this.referenceRepository.createUnit(dto);
    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'create',
      entity_type: 'units',
      entity_id: created.id,
      new_values: dto,
      request_id: meta.requestId,
      ip: meta.ip,
    });
    return created;
  }

  async updateUnit(
    id: string,
    dto: UpdateUnitDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const unit = await this.referenceRepository.findUnitById(id);
    if (!unit) throw new NotFoundException('Satuan tidak ditemukan.');
    const updated = await this.referenceRepository.updateUnit(id, dto);
    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'update',
      entity_type: 'units',
      entity_id: id,
      new_values: dto,
      request_id: meta.requestId,
      ip: meta.ip,
    });
    return updated;
  }

  async listDosageForms() {
    return await this.referenceRepository.findAllDosageForms();
  }

  async createDosageForm(
    dto: CreateDosageFormDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const existing = await this.referenceRepository.findDosageFormByName(dto.name.trim());
    if (existing) {
      throw new ConflictException(`Bentuk sediaan "${dto.name}" sudah ada.`);
    }
    const created = await this.referenceRepository.createDosageForm(dto);
    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'create',
      entity_type: 'dosage_forms',
      entity_id: created.id,
      new_values: dto,
      request_id: meta.requestId,
      ip: meta.ip,
    });
    return created;
  }

  async updateDosageForm(
    id: string,
    dto: UpdateDosageFormDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const form = await this.referenceRepository.findDosageFormById(id);
    if (!form) throw new NotFoundException('Bentuk sediaan tidak ditemukan.');
    const updated = await this.referenceRepository.updateDosageForm(id, dto);
    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'update',
      entity_type: 'dosage_forms',
      entity_id: id,
      new_values: dto,
      request_id: meta.requestId,
      ip: meta.ip,
    });
    return updated;
  }

  // ==========================================================================
  // Suppliers (FR-1.3)
  // ==========================================================================

  async listSuppliers() {
    return await this.supplierRepository.findAll();
  }

  async createSupplier(
    dto: CreateSupplierDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    if (dto.code) {
      const existing = await this.supplierRepository.findByCode(dto.code);
      if (existing) {
        throw new ConflictException(`Supplier dengan kode "${dto.code}" sudah ada.`);
      }
    }
    const created = await this.supplierRepository.create(dto);
    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'create',
      entity_type: 'suppliers',
      entity_id: created.id,
      new_values: dto,
      request_id: meta.requestId,
      ip: meta.ip,
    });
    return created;
  }

  async updateSupplier(
    id: string,
    dto: UpdateSupplierDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const supplier = await this.supplierRepository.findById(id);
    if (!supplier) throw new NotFoundException('Supplier tidak ditemukan.');
    const updated = await this.supplierRepository.update(id, dto);
    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'update',
      entity_type: 'suppliers',
      entity_id: id,
      new_values: dto,
      request_id: meta.requestId,
      ip: meta.ip,
    });
    return updated;
  }

  // ==========================================================================
  // Locations (FR-1.4)
  // ==========================================================================

  async listLocations() {
    return await this.locationRepository.findAll();
  }

  async createLocation(
    dto: CreateLocationDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const existing = await this.locationRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(`Lokasi dengan kode "${dto.code}" sudah ada.`);
    }
    const created = await this.locationRepository.create(dto);
    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'create',
      entity_type: 'locations',
      entity_id: created.id,
      new_values: dto,
      request_id: meta.requestId,
      ip: meta.ip,
    });
    return created;
  }

  async updateLocation(
    id: string,
    dto: UpdateLocationDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const location = await this.locationRepository.findById(id);
    if (!location) throw new NotFoundException('Lokasi tidak ditemukan.');
    const updated = await this.locationRepository.update(id, dto);
    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'update',
      entity_type: 'locations',
      entity_id: id,
      new_values: dto,
      request_id: meta.requestId,
      ip: meta.ip,
    });
    return updated;
  }
}
