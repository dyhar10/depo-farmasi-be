import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({ example: 'TAB' })
  @IsString()
  @IsNotEmpty({ message: 'Kode satuan tidak boleh kosong' })
  code!: string;

  @ApiProperty({ example: 'Tablet' })
  @IsString()
  @IsNotEmpty({ message: 'Nama satuan tidak boleh kosong' })
  name!: string;
}

export class UpdateUnitDto {
  @ApiPropertyOptional({ example: 'TAB' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'Tablet Salut' })
  @IsOptional()
  @IsString()
  name?: string;
}

export class CreateDosageFormDto {
  @ApiProperty({ example: 'Tablet Salut Selaput' })
  @IsString()
  @IsNotEmpty({ message: 'Nama bentuk sediaan tidak boleh kosong' })
  name!: string;
}

export class UpdateDosageFormDto {
  @ApiProperty({ example: 'Tablet Salut Gula' })
  @IsString()
  @IsNotEmpty({ message: 'Nama bentuk sediaan tidak boleh kosong' })
  name!: string;
}
