import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoryDto {
  @ApiPropertyOptional({ example: 'uuid-parent-category', nullable: true })
  @IsOptional()
  @IsUUID('all')
  parent_id?: string | null;

  @ApiProperty({ enum: ['obat', 'bmhp'], example: 'obat' })
  @IsIn(['obat', 'bmhp'])
  item_type!: 'obat' | 'bmhp';

  @ApiProperty({ example: 'OBAT_GEN' })
  @IsString()
  @IsNotEmpty({ message: 'Kode kategori tidak boleh kosong' })
  code!: string;

  @ApiProperty({ example: 'Obat Generik' })
  @IsString()
  @IsNotEmpty({ message: 'Nama kategori tidak boleh kosong' })
  name!: string;

  @ApiProperty({ example: 2, description: 'Level kategori 1..3' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  level!: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Obat Generik Terjadwal' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
