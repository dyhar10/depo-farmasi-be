import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateItemDto {
  @ApiProperty({ example: 'CL0105-B', description: 'Kodifikasi unik item, disimpan apa adanya' })
  @IsString()
  @IsNotEmpty({ message: 'Kode item tidak boleh kosong' })
  code!: string;

  @ApiProperty({ enum: ['obat', 'bmhp'], example: 'obat' })
  @IsIn(['obat', 'bmhp'], { message: 'Jenis item harus obat atau bmhp' })
  item_type!: 'obat' | 'bmhp';

  @ApiProperty({ example: 'uuid-category' })
  @IsUUID('all', { message: 'category_id harus berupa UUID yang valid' })
  category_id!: string;

  @ApiProperty({ example: 'Paracetamol' })
  @IsString()
  @IsNotEmpty({ message: 'Nama generik tidak boleh kosong' })
  generic_name!: string;

  @ApiPropertyOptional({ example: 'Panadol' })
  @IsOptional()
  @IsString()
  brand_name?: string;

  @ApiPropertyOptional({ example: 'uuid-dosage-form' })
  @IsOptional()
  @IsUUID('all')
  dosage_form_id?: string;

  @ApiPropertyOptional({ example: '500 mg' })
  @IsOptional()
  @IsString()
  strength?: string;

  @ApiPropertyOptional({ example: 'N02BE01' })
  @IsOptional()
  @IsString()
  atc_code?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  ddd?: number;

  @ApiProperty({ example: 'uuid-base-unit', description: 'Satuan terkecil (Tablet, Botol, Pcs)' })
  @IsUUID('all', { message: 'base_unit_id harus berupa UUID yang valid' })
  base_unit_id!: string;

  @ApiPropertyOptional({ example: 'uuid-purchase-unit', description: 'Satuan beli / besar (Box, Dus)' })
  @IsOptional()
  @IsUUID('all')
  purchase_unit_id?: string;

  @ApiPropertyOptional({ example: 100, default: 1, description: 'Isi satuan kecil per satuan besar' })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'pack_size harus bernilai lebih besar dari 0' })
  pack_size?: number;

  @ApiPropertyOptional({ enum: ['ekatalog', 'non_ekatalog'], default: 'ekatalog' })
  @IsOptional()
  @IsIn(['ekatalog', 'non_ekatalog'])
  catalog_type?: 'ekatalog' | 'non_ekatalog';

  @ApiPropertyOptional({ enum: ['formularium', 'non_formularium'] })
  @IsOptional()
  @IsIn(['formularium', 'non_formularium'])
  formulary_status?: 'formularium' | 'non_formularium';

  @ApiPropertyOptional({ enum: ['fornas_generik', 'fornas_non_generik', 'non_fornas_non_generik'] })
  @IsOptional()
  @IsIn(['fornas_generik', 'fornas_non_generik', 'non_fornas_non_generik'])
  fornas_class?: 'fornas_generik' | 'fornas_non_generik' | 'non_fornas_non_generik';

  @ApiPropertyOptional({ example: 500.0, description: 'Harga acuan perencanaan per satuan kecil' })
  @IsOptional()
  @Type(() => Number)
  @Min(0, { message: 'reference_price tidak boleh negatif' })
  reference_price?: number;
}

export class UpdateItemDto {
  @ApiPropertyOptional({ example: 'uuid-category' })
  @IsOptional()
  @IsUUID('all')
  category_id?: string;

  @ApiPropertyOptional({ example: 'Paracetamol Forte' })
  @IsOptional()
  @IsString()
  generic_name?: string;

  @ApiPropertyOptional({ example: 'Sanmol Forte' })
  @IsOptional()
  @IsString()
  brand_name?: string;

  @ApiPropertyOptional({ example: 'uuid-dosage-form' })
  @IsOptional()
  @IsUUID('all')
  dosage_form_id?: string;

  @ApiPropertyOptional({ example: '650 mg' })
  @IsOptional()
  @IsString()
  strength?: string;

  @ApiPropertyOptional({ example: 'N02BE01' })
  @IsOptional()
  @IsString()
  atc_code?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  ddd?: number;

  @ApiPropertyOptional({ example: 'uuid-base-unit' })
  @IsOptional()
  @IsUUID('all')
  base_unit_id?: string;

  @ApiPropertyOptional({ example: 'uuid-purchase-unit' })
  @IsOptional()
  @IsUUID('all')
  purchase_unit_id?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  pack_size?: number;

  @ApiPropertyOptional({ enum: ['ekatalog', 'non_ekatalog'] })
  @IsOptional()
  @IsIn(['ekatalog', 'non_ekatalog'])
  catalog_type?: 'ekatalog' | 'non_ekatalog';

  @ApiPropertyOptional({ enum: ['formularium', 'non_formularium'] })
  @IsOptional()
  @IsIn(['formularium', 'non_formularium'])
  formulary_status?: 'formularium' | 'non_formularium';

  @ApiPropertyOptional({ enum: ['fornas_generik', 'fornas_non_generik', 'non_fornas_non_generik'] })
  @IsOptional()
  @IsIn(['fornas_generik', 'fornas_non_generik', 'non_fornas_non_generik'])
  fornas_class?: 'fornas_generik' | 'fornas_non_generik' | 'non_fornas_non_generik';

  @ApiPropertyOptional({ example: 600.0 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  reference_price?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdatePlanningParamsDto {
  @ApiProperty({ example: 100, description: 'Safety stock dalam satuan kecil' })
  @Type(() => Number)
  @Min(0, { message: 'safety_stock tidak boleh negatif' })
  safety_stock!: number;

  @ApiProperty({ example: 200, description: 'Minimum stock (harus >= safety_stock)' })
  @Type(() => Number)
  @Min(0, { message: 'min_stock tidak boleh negatif' })
  min_stock!: number;

  @ApiPropertyOptional({ enum: ['fast_1', 'fast_2', 'slow', 'non_moving'] })
  @IsOptional()
  @IsIn(['fast_1', 'fast_2', 'slow', 'non_moving'])
  moving_class?: 'fast_1' | 'fast_2' | 'slow' | 'non_moving';

  @ApiPropertyOptional({ example: 'Beli minimal 1/2 dus' })
  @IsOptional()
  @IsString()
  purchase_note?: string;
}

export class ItemQueryDto {
  @ApiPropertyOptional({ description: 'Kata kunci pencarian (kode, nama generik, merk)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter berdasarkan ID kategori' })
  @IsOptional()
  @IsUUID('all')
  category_id?: string;

  @ApiPropertyOptional({ enum: ['obat', 'bmhp'] })
  @IsOptional()
  @IsIn(['obat', 'bmhp'])
  type?: 'obat' | 'bmhp';

  @ApiPropertyOptional({ description: 'Filter item aktif saja (default true)' })
  @IsOptional()
  @Type(() => Boolean)
  is_active?: boolean;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}
