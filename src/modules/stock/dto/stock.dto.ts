import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class StockBalanceQueryDto {
  @ApiPropertyOptional({ description: 'Filter berdasarkan ID item', type: String })
  @IsOptional()
  @IsUUID('all', { message: 'item_id harus berupa UUID yang valid' })
  item_id?: string;

  @ApiPropertyOptional({ description: 'Filter berdasarkan ID lokasi', type: String })
  @IsOptional()
  @IsUUID('all', { message: 'location_id harus berupa UUID yang valid' })
  location_id?: string;
}

export class StockBalanceItemDto {
  @ApiProperty({ type: String, example: '01934335-508b-7c30-97c7-578841443653' })
  item_id!: string;

  @ApiProperty({ type: String, example: 'AA0096' })
  item_code!: string;

  @ApiProperty({ type: String, example: 'Paracetamol' })
  item_name!: string;

  @ApiProperty({ type: String, example: 'obat' })
  item_type!: string;

  @ApiProperty({ type: String, example: '01934335-508b-7c30-97c7-578841443654' })
  location_id!: string;

  @ApiProperty({ type: String, example: 'Gudang Farmasi Utama' })
  location_name!: string;

  @ApiProperty({ type: String, example: '150.000' })
  quantity!: string;

  @ApiProperty({ type: String, example: '50.000' })
  safety_stock!: string;

  @ApiProperty({ type: String, example: '100.000' })
  min_stock!: string;

  @ApiProperty({ type: String, enum: ['cito', 'menipis_cito', 'menipis', 'aman'], example: 'aman' })
  status!: string;

  @ApiProperty({ type: String, example: '750000.0000' })
  total_valuation!: string;
}

export class BatchStockDto {
  @ApiProperty({ type: String, example: '01934335-508b-7c30-97c7-578841443655' })
  batch_id!: string;

  @ApiProperty({ type: String, example: 'LEGACY-1' })
  batch_number!: string;

  @ApiPropertyOptional({ type: String, example: '2027-12-31' })
  expiry_date!: string | null;

  @ApiProperty({ type: String, example: '5000.0000' })
  unit_cost!: string;

  @ApiProperty({ type: String, example: '100.000' })
  quantity!: string;

  @ApiProperty({ type: Boolean, example: true })
  is_legacy!: boolean;

  @ApiProperty({ type: String, example: '500000.0000' })
  valuation!: string;
}

export class LocationStockDetailDto {
  @ApiProperty({ type: String, example: '01934335-508b-7c30-97c7-578841443654' })
  location_id!: string;

  @ApiProperty({ type: String, example: 'GUDANG-01' })
  location_code!: string;

  @ApiProperty({ type: String, example: 'Gudang Farmasi Utama' })
  location_name!: string;

  @ApiProperty({ type: String, example: '150.000' })
  quantity!: string;

  @ApiProperty({ type: [BatchStockDto] })
  batches!: BatchStockDto[];
}

export class ItemStockDetailDto {
  @ApiProperty({ type: String, example: '01934335-508b-7c30-97c7-578841443653' })
  item_id!: string;

  @ApiProperty({ type: String, example: 'AA0096' })
  item_code!: string;

  @ApiProperty({ type: String, example: 'Paracetamol' })
  item_name!: string;

  @ApiProperty({ type: String, example: '150.000' })
  total_quantity!: string;

  @ApiProperty({ type: String, example: '750000.0000' })
  total_valuation!: string;

  @ApiProperty({ type: [LocationStockDetailDto] })
  locations!: LocationStockDetailDto[];
}
