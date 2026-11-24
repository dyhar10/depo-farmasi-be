import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ImportType, ImportJobStatus, ImportJobSummary } from '../domain/import.entity';

export class UploadImportDto {
  @ApiProperty({
    enum: ['items', 'opening_balance', 'suppliers', 'locations'],
    example: 'items',
    description: 'Jenis data yang akan diimpor',
  })
  @IsNotEmpty({ message: 'Tipe impor wajib dipilih' })
  @IsIn(['items', 'opening_balance', 'suppliers', 'locations'], {
    message: 'Tipe impor harus salah satu dari: items, opening_balance, suppliers, locations',
  })
  import_type!: ImportType;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description: 'Mode dry-run: hanya memvalidasi dan menghitung ringkasan tanpa menulis ke database',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'false' || value === false) return false;
    return true;
  })
  @IsBoolean()
  dry_run: boolean = true;
}

export class ImportJobErrorDto {
  @ApiPropertyOptional({ type: String, example: 'Sheet1' })
  sheet!: string | null;

  @ApiPropertyOptional({ type: Number, example: 15 })
  row_number!: number | null;

  @ApiPropertyOptional({ type: String, example: 'code' })
  field!: string | null;

  @ApiProperty({ type: String, example: 'Kode item duplikat dalam database' })
  message!: string;
}

export class ImportJobResponseDto {
  @ApiProperty({ type: String, example: '01934335-508b-7c30-97c7-578841443653' })
  id!: string;

  @ApiProperty({ type: String, enum: ['items', 'opening_balance', 'suppliers', 'locations'], example: 'items' })
  import_type!: ImportType;

  @ApiProperty({ type: String, example: 'master_item_mei_2026.xlsx' })
  filename!: string;

  @ApiProperty({ type: String, example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' })
  file_sha256!: string;

  @ApiProperty({
    type: String,
    enum: ['uploaded', 'validating', 'validated', 'importing', 'completed', 'failed'],
    example: 'validated',
  })
  status!: ImportJobStatus;

  @ApiProperty({ type: Boolean, example: true })
  dry_run!: boolean;

  @ApiProperty({
    type: () => Object,
    example: {
      totalRows: 1374,
      validRows: 1370,
      invalidRows: 4,
    },
  })
  summary!: ImportJobSummary;

  @ApiProperty({ type: String, example: '2026-11-24T10:00:00.000Z' })
  created_at!: string;

  @ApiPropertyOptional({ type: String, example: '2026-11-24T10:01:00.000Z' })
  finished_at!: string | null;
}

export class ImportJobDetailDto extends ImportJobResponseDto {
  @ApiProperty({ type: () => [ImportJobErrorDto] })
  errors!: ImportJobErrorDto[];
}
