import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({ example: 'GUD_UTAMA' })
  @IsString()
  @IsNotEmpty({ message: 'Kode lokasi tidak boleh kosong' })
  code!: string;

  @ApiProperty({ example: 'Gudang Farmasi Utama' })
  @IsString()
  @IsNotEmpty({ message: 'Nama lokasi tidak boleh kosong' })
  name!: string;

  @ApiProperty({
    enum: [
      'gudang',
      'depo',
      'ruangan',
      'inventaris',
      'troli_emergensi',
      'laboratorium',
      'radiologi',
      'lainnya',
    ],
    example: 'gudang',
  })
  @IsIn([
    'gudang',
    'depo',
    'ruangan',
    'inventaris',
    'troli_emergensi',
    'laboratorium',
    'radiologi',
    'lainnya',
  ])
  location_type!:
    | 'gudang'
    | 'depo'
    | 'ruangan'
    | 'inventaris'
    | 'troli_emergensi'
    | 'laboratorium'
    | 'radiologi'
    | 'lainnya';

  @ApiPropertyOptional({ example: 'uuid-parent-location', nullable: true })
  @IsOptional()
  @IsUUID('all')
  parent_id?: string | null;

  @ApiPropertyOptional({
    default: true,
    description: 'false = hanya tujuan pengeluaran / tidak menyimpan saldo',
  })
  @IsOptional()
  @IsBoolean()
  holds_stock?: boolean;
}

export class UpdateLocationDto {
  @ApiPropertyOptional({ example: 'Gudang Farmasi Sentral' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    enum: [
      'gudang',
      'depo',
      'ruangan',
      'inventaris',
      'troli_emergensi',
      'laboratorium',
      'radiologi',
      'lainnya',
    ],
  })
  @IsOptional()
  @IsIn([
    'gudang',
    'depo',
    'ruangan',
    'inventaris',
    'troli_emergensi',
    'laboratorium',
    'radiologi',
    'lainnya',
  ])
  location_type?:
    | 'gudang'
    | 'depo'
    | 'ruangan'
    | 'inventaris'
    | 'troli_emergensi'
    | 'laboratorium'
    | 'radiologi'
    | 'lainnya';

  @ApiPropertyOptional({ example: 'uuid-parent-location', nullable: true })
  @IsOptional()
  @IsUUID('all')
  parent_id?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  holds_stock?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
