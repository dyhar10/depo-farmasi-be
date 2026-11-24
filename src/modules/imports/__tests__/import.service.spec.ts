import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportService } from '../services/import.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

describe('ImportService', () => {
  let service: ImportService;
  let mockUnitOfWork: any;
  let mockImportRepository: any;
  let mockPostingService: any;
  let mockAuditService: any;
  let mockOutboxService: any;

  beforeEach(() => {
    mockUnitOfWork = {
      run: vi.fn().mockImplementation((cb) => cb('mock-tx')),
    };

    mockImportRepository = {
      createJob: vi.fn().mockImplementation((data) => ({
        id: 'job-123',
        ...data,
        createdAt: new Date(),
        finishedAt: null,
      })),
      findJobById: vi.fn(),
      findJobByHash: vi.fn().mockResolvedValue(null),
      updateJob: vi.fn().mockResolvedValue(undefined),
      insertErrors: vi.fn().mockResolvedValue(undefined),
      findJobErrors: vi.fn().mockResolvedValue([]),
      findExistingItemCodes: vi.fn().mockResolvedValue(new Set()),
      findAllUnits: vi.fn().mockResolvedValue([{ id: 'unit-tab', code: 'TAB', name: 'Tablet' }]),
      findAllCategories: vi.fn().mockResolvedValue([{ id: 'cat-umum', code: 'UMUM', name: 'Umum' }]),
      findAllDosageForms: vi.fn().mockResolvedValue([{ id: 'dos-tab', name: 'Tablet' }]),
      findAllLocations: vi.fn().mockResolvedValue([
        { id: 'loc-gudang', code: 'GUDANG', name: 'Gudang Utama', holds_stock: true, is_active: true },
      ]),
      insertItems: vi.fn().mockResolvedValue(undefined),
      insertPlanningParams: vi.fn().mockResolvedValue(undefined),
    };

    mockPostingService = {
      post: vi.fn().mockResolvedValue({ movementIds: ['mov-1'] }),
    };

    mockAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    mockOutboxService = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    service = new ImportService(
      mockUnitOfWork,
      mockImportRepository,
      mockPostingService,
      mockAuditService,
      mockOutboxService,
    );
  });

  async function createSampleExcelBuffer(
    headers: string[],
    rows: Array<Array<any>>,
    sheetName = 'Sheet1',
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.addRow(headers);
    for (const r of rows) {
      worksheet.addRow(r);
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  it('harus menolak unggahan jika berkas kosong', async () => {
    await expect(
      service.createImportJob(null as any, { import_type: 'items', dry_run: true }, 'user-admin'),
    ).rejects.toThrow(BadRequestException);
  });

  it('harus berhasil memvalidasi (dry-run) berkas item yang valid (AC-1)', async () => {
    const buffer = await createSampleExcelBuffer(
      ['Kodifikasi', 'Nama Obat (Generik) / (Merk)', 'Satuan Kecil', 'Kemasan', 'Ekatalog / Non Ekatalog'],
      [
        ['AA0096', 'Paracetamol 500mg', 'TAB', 10, 'Non Ekatalog'],
        ['BK0001', 'Amoxicillin 500mg', 'TAB', 10, 'Ekatalog'],
      ],
    );

    const mockFile = {
      originalname: 'items_test.xlsx',
      buffer,
    } as Express.Multer.File;

    const result = await service.createImportJob(
      mockFile,
      { import_type: 'items', dry_run: true },
      'user-admin',
    );

    expect(result.id).toBe('job-123');
    expect(result.status).toBe('validated');
    expect(result.summary.validRows).toBe(2);
    expect(result.summary.invalidRows).toBe(0);
    expect(mockImportRepository.insertErrors).toHaveBeenCalledWith([]);
  });

  it('harus mencatat galat jika kode item duplikat di dalam berkas (AC-4)', async () => {
    const buffer = await createSampleExcelBuffer(
      ['Kodifikasi', 'Nama Obat (Generik) / (Merk)', 'Satuan Kecil'],
      [
        ['AA0096', 'Paracetamol 500mg', 'TAB'],
        ['AA0096', 'Paracetamol Duplikat', 'TAB'],
      ],
    );

    const mockFile = {
      originalname: 'items_dup.xlsx',
      buffer,
    } as Express.Multer.File;

    const result = await service.createImportJob(
      mockFile,
      { import_type: 'items', dry_run: true },
      'user-admin',
    );

    expect(result.summary.validRows).toBe(1);
    expect(result.summary.invalidRows).toBe(1);
    expect(mockImportRepository.insertErrors).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'code',
          message: expect.stringContaining('duplikat dalam berkas spreadsheet'),
        }),
      ]),
    );
  });

  it('harus mencatat galat jika kode item sudah ada di database sistem', async () => {
    mockImportRepository.findExistingItemCodes.mockResolvedValueOnce(new Set(['AA0096']));

    const buffer = await createSampleExcelBuffer(
      ['Kodifikasi', 'Nama Obat (Generik) / (Merk)', 'Satuan Kecil'],
      [['AA0096', 'Paracetamol 500mg', 'TAB']],
    );

    const mockFile = {
      originalname: 'items_existing.xlsx',
      buffer,
    } as Express.Multer.File;

    const result = await service.createImportJob(
      mockFile,
      { import_type: 'items', dry_run: true },
      'user-admin',
    );

    expect(result.summary.validRows).toBe(0);
    expect(result.summary.invalidRows).toBe(1);
    expect(mockImportRepository.insertErrors).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'code',
          message: expect.stringContaining('sudah terdaftar di sistem'),
        }),
      ]),
    );
  });

  it('harus menolak eksekusi jika status job bukan validated', async () => {
    mockImportRepository.findJobById.mockResolvedValueOnce({
      id: 'job-123',
      status: 'validating',
      summary: {},
    });

    await expect(service.executeImportJob('job-123', 'user-admin')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('harus menolak eksekusi jika job sudah completed sebelumnya', async () => {
    mockImportRepository.findJobById.mockResolvedValueOnce({
      id: 'job-123',
      status: 'completed',
      summary: {},
    });

    await expect(service.executeImportJob('job-123', 'user-admin')).rejects.toThrow(
      ConflictException,
    );
  });
});
