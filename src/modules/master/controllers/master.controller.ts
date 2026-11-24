import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { LocationGuard } from '../../../common/guards/location.guard';
import { MasterService } from '../services/master.service';
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

@ApiTags('Master Data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, LocationGuard)
@Controller('api/v1')
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  // ==========================================================================
  // Items (FR-1.1, FR-1.5, FR-1.10)
  // ==========================================================================

  @Get('items')
  @RequirePermissions('master.item.read')
  @ApiOperation({ summary: 'Daftar dan pencarian cepat item obat/BMHP' })
  async listItems(@Query() query: ItemQueryDto) {
    return await this.masterService.listItems(query);
  }

  @Post('items')
  @RequirePermissions('master.item.write')
  @ApiOperation({ summary: 'Membuat item baru' })
  async createItem(
    @Body() dto: CreateItemDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.masterService.createItem(dto, meta);
  }

  @Get('items/:id')
  @RequirePermissions('master.item.read')
  @ApiOperation({ summary: 'Detail item obat/BMHP' })
  async getItem(@Param('id') id: string) {
    return await this.masterService.getItem(id);
  }

  @Patch('items/:id')
  @RequirePermissions('master.item.write')
  @ApiOperation({ summary: 'Mengubah master item obat/BMHP' })
  async updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.masterService.updateItem(id, dto, meta);
  }

  @Put('items/:id/planning-params')
  @RequirePermissions('master.item.write')
  @ApiOperation({ summary: 'Memperbarui parameter perencanaan item' })
  async updatePlanningParams(
    @Param('id') id: string,
    @Body() dto: UpdatePlanningParamsDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.masterService.updatePlanningParams(id, dto, meta);
  }

  // ==========================================================================
  // Categories (FR-1.2)
  // ==========================================================================

  @Get('item-categories')
  @ApiOperation({ summary: 'Daftar hierarki kategori obat dan BMHP' })
  async listCategories() {
    return await this.masterService.listCategories();
  }

  @Post('item-categories')
  @RequirePermissions('master.item.write')
  @ApiOperation({ summary: 'Membuat kategori baru' })
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.masterService.createCategory(dto, meta);
  }

  @Patch('item-categories/:id')
  @RequirePermissions('master.item.write')
  @ApiOperation({ summary: 'Mengubah kategori' })
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.masterService.updateCategory(id, dto, meta);
  }

  // ==========================================================================
  // Reference: Units & Dosage Forms (FR-1.2)
  // ==========================================================================

  @Get('units')
  @ApiOperation({ summary: 'Daftar semua satuan baku' })
  async listUnits() {
    return await this.masterService.listUnits();
  }

  @Post('units')
  @RequirePermissions('master.item.write')
  @ApiOperation({ summary: 'Membuat satuan baku baru' })
  async createUnit(
    @Body() dto: CreateUnitDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.masterService.createUnit(dto, meta);
  }

  @Patch('units/:id')
  @RequirePermissions('master.item.write')
  @ApiOperation({ summary: 'Mengubah satuan baku' })
  async updateUnit(
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.masterService.updateUnit(id, dto, meta);
  }

  @Get('dosage-forms')
  @ApiOperation({ summary: 'Daftar semua bentuk sediaan' })
  async listDosageForms() {
    return await this.masterService.listDosageForms();
  }

  @Post('dosage-forms')
  @RequirePermissions('master.item.write')
  @ApiOperation({ summary: 'Membuat bentuk sediaan baru' })
  async createDosageForm(
    @Body() dto: CreateDosageFormDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.masterService.createDosageForm(dto, meta);
  }

  @Patch('dosage-forms/:id')
  @RequirePermissions('master.item.write')
  @ApiOperation({ summary: 'Mengubah bentuk sediaan' })
  async updateDosageForm(
    @Param('id') id: string,
    @Body() dto: UpdateDosageFormDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.masterService.updateDosageForm(id, dto, meta);
  }

  // ==========================================================================
  // Suppliers (FR-1.3)
  // ==========================================================================

  @Get('suppliers')
  @ApiOperation({ summary: 'Daftar semua pemasok / distributor' })
  async listSuppliers() {
    return await this.masterService.listSuppliers();
  }

  @Post('suppliers')
  @RequirePermissions('master.supplier.write')
  @ApiOperation({ summary: 'Membuat supplier baru' })
  async createSupplier(
    @Body() dto: CreateSupplierDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.masterService.createSupplier(dto, meta);
  }

  @Patch('suppliers/:id')
  @RequirePermissions('master.supplier.write')
  @ApiOperation({ summary: 'Mengubah data supplier' })
  async updateSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.masterService.updateSupplier(id, dto, meta);
  }

  // ==========================================================================
  // Locations (FR-1.4)
  // ==========================================================================

  @Get('locations')
  @ApiOperation({ summary: 'Daftar semua lokasi' })
  async listLocations() {
    return await this.masterService.listLocations();
  }

  @Post('locations')
  @RequirePermissions('master.location.write')
  @ApiOperation({ summary: 'Membuat lokasi baru' })
  async createLocation(
    @Body() dto: CreateLocationDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.masterService.createLocation(dto, meta);
  }

  @Patch('locations/:id')
  @RequirePermissions('master.location.write')
  @ApiOperation({ summary: 'Mengubah data lokasi' })
  async updateLocation(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.masterService.updateLocation(id, dto, meta);
  }
}
