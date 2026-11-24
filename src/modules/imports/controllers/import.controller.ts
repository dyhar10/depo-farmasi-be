import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ImportService } from '../services/import.service';
import { UploadImportDto, ImportJobResponseDto, ImportJobDetailDto } from '../dto/import.dto';
import { ImportJobEntity } from '../domain/import.entity';

function toResponseDto(job: ImportJobEntity): ImportJobResponseDto {
  return {
    id: job.id,
    import_type: job.importType,
    filename: job.filename,
    file_sha256: job.fileSha256,
    status: job.status,
    dry_run: job.dryRun,
    summary: job.summary,
    created_at: job.createdAt.toISOString(),
    finished_at: job.finishedAt ? job.finishedAt.toISOString() : null,
  };
}

@ApiTags('Imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/imports')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post()
  @RequirePermissions('import.run')
  @ApiOperation({
    summary: 'Unggah berkas Excel untuk validasi (dry-run) atau eksekusi langsung',
    description:
      'Mendukung tipe items, opening_balance, suppliers, dan locations. Default dry_run=true untuk memverifikasi data dan menampilkan rekonsiliasi.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        import_type: {
          type: 'string',
          enum: ['items', 'opening_balance', 'suppliers', 'locations'],
        },
        dry_run: { type: 'boolean', default: true },
      },
      required: ['file', 'import_type'],
    },
  })
  @ApiResponse({
    status: 201,
    type: ImportJobResponseDto,
    description: 'Job impor berhasil dibuat dan divalidasi',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImport(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadImportDto,
    @CurrentUser('id') userId: string,
  ): Promise<ImportJobResponseDto> {
    if (!file) {
      throw new BadRequestException('Berkas Excel (.xlsx / .xls) wajib diunggah.');
    }
    const job = await this.importService.createImportJob(file, dto, userId);
    return toResponseDto(job);
  }

  @Get(':id')
  @RequirePermissions('import.run')
  @ApiOperation({
    summary: 'Melihat status, ringkasan rekonsiliasi, dan daftar galat impor',
  })
  @ApiResponse({
    status: 200,
    type: ImportJobDetailDto,
    description: 'Rincian job impor beserta daftar galat per baris',
  })
  async getImportJob(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<ImportJobDetailDto> {
    return await this.importService.getJobDetail(id);
  }

  @Post(':id/execute')
  @RequirePermissions('import.run')
  @ApiOperation({
    summary: 'Mengeksekusi job impor yang sudah divalidasi (menulis data ke database)',
  })
  @ApiResponse({
    status: 200,
    type: ImportJobResponseDto,
    description: 'Job impor berhasil dieksekusi',
  })
  async executeImport(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<ImportJobResponseDto> {
    const job = await this.importService.executeImportJob(id, userId);
    return toResponseDto(job);
  }
}
