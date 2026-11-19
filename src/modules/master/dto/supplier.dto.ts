import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSupplierDto {
  @ApiPropertyOptional({ example: 'SUP001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'PT Kimia Farma Trading' })
  @IsString()
  @IsNotEmpty({ message: 'Nama supplier tidak boleh kosong' })
  name!: string;

  @ApiProperty({
    enum: ['penyedia', 'distributor', 'donor', 'lainnya'],
    example: 'distributor',
  })
  @IsIn(['penyedia', 'distributor', 'donor', 'lainnya'])
  supplier_type!: 'penyedia' | 'distributor' | 'donor' | 'lainnya';

  @ApiPropertyOptional({ example: { phone: '021-1234567', email: 'sales@kf.local' } })
  @IsOptional()
  @IsObject()
  contact?: Record<string, any>;
}

export class UpdateSupplierDto {
  @ApiPropertyOptional({ example: 'SUP001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'PT Kimia Farma Trading & Distribution' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ['penyedia', 'distributor', 'donor', 'lainnya'] })
  @IsOptional()
  @IsIn(['penyedia', 'distributor', 'donor', 'lainnya'])
  supplier_type?: 'penyedia' | 'distributor' | 'donor' | 'lainnya';

  @ApiPropertyOptional({ example: { phone: '021-7654321' } })
  @IsOptional()
  @IsObject()
  contact?: Record<string, any>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
