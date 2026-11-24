import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportController } from '../controllers/import.controller';
import { ImportService } from '../services/import.service';

describe('ImportController', () => {
  let controller: ImportController;
  let mockImportService: any;

  beforeEach(() => {
    mockImportService = {
      createImportJob: vi.fn().mockResolvedValue({
        id: 'job-1',
        importType: 'items',
        filename: 'items.xlsx',
        fileSha256: 'hash123',
        status: 'validated',
        dryRun: true,
        summary: { totalRows: 10, validRows: 10, invalidRows: 0 },
        createdBy: 'user-admin',
        createdAt: new Date('2026-11-24T10:00:00Z'),
        finishedAt: null,
      }),
      getJobDetail: vi.fn().mockResolvedValue({
        id: 'job-1',
        import_type: 'items',
        filename: 'items.xlsx',
        file_sha256: 'hash123',
        status: 'validated',
        dry_run: true,
        summary: { totalRows: 10, validRows: 10, invalidRows: 0 },
        created_at: '2026-11-24T10:00:00.000Z',
        finished_at: null,
        errors: [],
      }),
      executeImportJob: vi.fn().mockResolvedValue({
        id: 'job-1',
        importType: 'items',
        filename: 'items.xlsx',
        fileSha256: 'hash123',
        status: 'completed',
        dryRun: false,
        summary: { totalRows: 10, validRows: 10, invalidRows: 0, createdCount: 10 },
        createdBy: 'user-admin',
        createdAt: new Date('2026-11-24T10:00:00Z'),
        finishedAt: new Date('2026-11-24T10:01:00Z'),
      }),
    };

    controller = new ImportController(mockImportService as ImportService);
  });

  it('harus berhasil memproses upload import dan mengembalikan DTO respon', async () => {
    const mockFile = {
      originalname: 'items.xlsx',
      buffer: Buffer.from('dummy'),
    } as Express.Multer.File;

    const result = await controller.uploadImport(
      mockFile,
      { import_type: 'items', dry_run: true },
      'user-admin',
    );

    expect(result.id).toBe('job-1');
    expect(result.import_type).toBe('items');
    expect(result.dry_run).toBe(true);
    expect(mockImportService.createImportJob).toHaveBeenCalledWith(
      mockFile,
      { import_type: 'items', dry_run: true },
      'user-admin',
    );
  });

  it('harus mengembalikan rincian job import beserta error saat memanggil getImportJob', async () => {
    const result = await controller.getImportJob('01934335-508b-7c30-97c7-578841443653');
    expect(result.id).toBe('job-1');
    expect(result.errors).toEqual([]);
    expect(mockImportService.getJobDetail).toHaveBeenCalledWith(
      '01934335-508b-7c30-97c7-578841443653',
    );
  });

  it('harus mengeksekusi job import saat memanggil executeImport', async () => {
    const result = await controller.executeImport(
      '01934335-508b-7c30-97c7-578841443653',
      'user-admin',
    );
    expect(result.id).toBe('job-1');
    expect(result.status).toBe('completed');
    expect(mockImportService.executeImportJob).toHaveBeenCalledWith(
      '01934335-508b-7c30-97c7-578841443653',
      'user-admin',
    );
  });
});
