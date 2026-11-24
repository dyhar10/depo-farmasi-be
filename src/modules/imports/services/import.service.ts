import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { UnitOfWork } from '../../../infrastructure/database/unit-of-work';
import { ImportRepository } from '../repositories/import.repository';
import { PostingService } from '../../stock/services/posting.service';
import { AuditService } from '../../audit/services/audit.service';
import { OutboxService } from '../../platform/services/outbox.service';
import { ExcelParser } from '../domain/excel-parser';
import { ImportNormalizer } from '../domain/import-normalizer';
import { ItemDomainRules } from '../../master/domain/item.rules';
import { generateUuidV7 } from '../../../common/utils/uuid';
import {
  ImportType,
  ImportJobEntity,
  ImportJobSummary,
  ParsedItemRow,
  ParsedOpeningBalanceRow,
} from '../domain/import.entity';
import { UploadImportDto, ImportJobDetailDto } from '../dto/import.dto';
import { Decimal } from 'decimal.js';

@Injectable()
export class ImportService {
  private readonly uploadDir: string;

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly importRepository: ImportRepository,
    private readonly postingService: PostingService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
  ) {
    this.uploadDir = path.resolve(process.cwd(), 'uploads', 'imports');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async createImportJob(
    file: Express.Multer.File,
    dto: UploadImportDto,
    userId: string,
  ): Promise<ImportJobEntity> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Berkas Excel wajib diunggah.');
    }

    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Cek idempotensi: apakah file yang sama pernah diimpor dan sukses?
    const existingSuccess = await this.importRepository.findJobByHash(sha256, dto.import_type);
    const notes: string[] = [];
    if (existingSuccess) {
      notes.push(
        `Perhatian: Berkas dengan checksum identik (${sha256.substring(0, 8)}...) sudah pernah berhasil diimpor sebelumnya pada ${existingSuccess.createdAt.toISOString()}.`,
      );
    }

    // 1. Buat record job awal
    const job = await this.importRepository.createJob({
      importType: dto.import_type,
      filename: file.originalname,
      fileSha256: sha256,
      dryRun: dto.dry_run,
      status: 'validating',
      summary: {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        notes,
      },
      createdBy: userId,
    });

    // 2. Simpan buffer ke filesystem untuk kebutuhan eksekusi lanjutan jika dry-run
    const filePath = path.join(this.uploadDir, `${job.id}.xlsx`);
    fs.writeFileSync(filePath, file.buffer);

    // 3. Jalankan validasi sesuai jenis impor
    try {
      const validationSummary = await this.validateImport(job.id, file.buffer, dto.import_type);
      if (notes.length > 0) {
        validationSummary.notes = [...(validationSummary.notes || []), ...notes];
      }

      await this.importRepository.updateJob(job.id, {
        status: 'validated',
        summary: validationSummary,
      });

      job.status = 'validated';
      job.summary = validationSummary;

      // 4. Jika bukan dry-run, langsung jalankan eksekusi
      if (!dto.dry_run) {
        return await this.executeImportJob(job.id, userId);
      }

      return job;
    } catch (err: any) {
      await this.importRepository.updateJob(job.id, {
        status: 'failed',
        finishedAt: new Date(),
      });
      throw err;
    }
  }

  async executeImportJob(jobId: string, userId: string): Promise<ImportJobEntity> {
    const job = await this.importRepository.findJobById(jobId);
    if (!job) {
      throw new NotFoundException('Import job tidak ditemukan.');
    }

    if (job.status === 'completed') {
      throw new ConflictException('Import job ini sudah selesai dieksekusi sebelumnya.');
    }

    if (job.status !== 'validated') {
      throw new BadRequestException(
        `Import job belum siap dieksekusi (status saat ini: ${job.status}).`,
      );
    }

    const filePath = path.join(this.uploadDir, `${job.id}.xlsx`);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Berkas fisik impor tidak ditemukan di server.');
    }

    const fileBuffer = fs.readFileSync(filePath);
    await this.importRepository.updateJob(job.id, { status: 'importing' });

    try {
      let createdCount = 0;
      if (job.importType === 'items') {
        createdCount = await this.executeItemsImport(job.id, fileBuffer, userId);
      } else if (job.importType === 'opening_balance') {
        createdCount = await this.executeOpeningBalanceImport(job.id, fileBuffer, userId);
      } else if (job.importType === 'suppliers') {
        createdCount = await this.executeSuppliersImport(job.id, fileBuffer, userId);
      } else if (job.importType === 'locations') {
        createdCount = await this.executeLocationsImport(job.id, fileBuffer, userId);
      }

      const updatedSummary: ImportJobSummary = {
        ...job.summary,
        createdCount,
      };

      await this.importRepository.updateJob(job.id, {
        status: 'completed',
        dryRun: false,
        summary: updatedSummary,
        finishedAt: new Date(),
      });

      await this.auditService.log({
        actor_id: userId,
        action: 'import.execute',
        entity_type: 'import_jobs',
        entity_id: job.id,
        new_values: {
          importType: job.importType,
          filename: job.filename,
          createdCount,
        },
      });

      job.status = 'completed';
      job.dryRun = false;
      job.summary = updatedSummary;
      job.finishedAt = new Date();

      return job;
    } catch (err: any) {
      await this.importRepository.updateJob(job.id, {
        status: 'failed',
        finishedAt: new Date(),
      });
      throw err;
    }
  }

  async getJobDetail(jobId: string): Promise<ImportJobDetailDto> {
    const job = await this.importRepository.findJobById(jobId);
    if (!job) {
      throw new NotFoundException('Import job tidak ditemukan.');
    }

    const errors = await this.importRepository.findJobErrors(jobId);

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
      errors: errors.map((e) => ({
        sheet: e.sheet,
        row_number: e.rowNumber,
        field: e.field,
        message: e.message,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Validasi & Parsing
  // ---------------------------------------------------------------------------

  private async validateImport(
    jobId: string,
    buffer: Buffer,
    type: ImportType,
  ): Promise<ImportJobSummary> {
    if (type === 'items') {
      return await this.validateItems(jobId, buffer);
    }
    if (type === 'opening_balance') {
      return await this.validateOpeningBalance(jobId, buffer);
    }
    if (type === 'suppliers') {
      return await this.validateSuppliers(jobId, buffer);
    }
    if (type === 'locations') {
      return await this.validateLocations(jobId, buffer);
    }
    throw new BadRequestException(`Tipe impor ${type} belum didukung.`);
  }

  private async validateItems(jobId: string, buffer: Buffer): Promise<ImportJobSummary> {
    const worksheet = await ExcelParser.loadWorksheet(buffer);
    const { headerRowNumber, headerMap } = ExcelParser.findHeaderRow(worksheet, [
      'kodifikasi',
      'kode',
      'nama',
      'generik',
    ]);

    const errors: Array<{
      jobId: string;
      sheet?: string;
      rowNumber?: number;
      field?: string;
      message: string;
    }> = [];

    const parsedRows: ParsedItemRow[] = [];
    const seenCodesInFile = new Set<string>();

    const colCode = headerMap.get('kodifikasi') || headerMap.get('kode') || 1;
    const colName =
      headerMap.get('nama obat (generik) / (merk)') ||
      headerMap.get('nama generik') ||
      headerMap.get('nama') ||
      headerMap.get('nama barang') ||
      2;
    const colBrand = headerMap.get('nama obat (merk)') || headerMap.get('merk');
    const colType = headerMap.get('kategori (obat / bmhp)') || headerMap.get('jenis');
    const colCategory =
      headerMap.get('sub sub kategori format') ||
      headerMap.get('sub kategori format') ||
      headerMap.get('kategori');
    const colDosage = headerMap.get('bentuk sediaan');
    const colStrength = headerMap.get('kekuatan');
    const colAtc = headerMap.get('atc');
    const colDdd = headerMap.get('ddd');
    const colBaseUnit = headerMap.get('satuan kecil') || headerMap.get('satuan');
    const colPurchaseUnit = headerMap.get('satuan besar');
    const colPackSize = headerMap.get('kemasan') || headerMap.get('isi kemasan');
    const colCatalog = headerMap.get('ekatalog / non ekatalog') || headerMap.get('katalog');
    const colFormulary = headerMap.get('formularium rs / non formularium rs');
    const colFornas = headerMap.get('generik/non generik fornas');
    const colRefPrice =
      headerMap.get('harga per item') || headerMap.get('harga perencanaan') || headerMap.get('harga');
    const colSafety = headerMap.get('safety stok');
    const colMin = headerMap.get('min');

    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const rawCode = ExcelParser.extractCellValue(row.getCell(colCode));
      const code = ImportNormalizer.normalizeCode(rawCode);

      if (!code) {
        // Abaikan baris kosong tanpa kode
        continue;
      }

      const rawName = ExcelParser.extractCellValue(row.getCell(colName));
      const genericName = ImportNormalizer.normalizeText(rawName);

      if (!genericName) {
        errors.push({
          jobId,
          sheet: worksheet.name,
          rowNumber: r,
          field: 'generic_name',
          message: `Baris ${r}: Nama item wajib diisi.`,
        });
        continue;
      }

      if (seenCodesInFile.has(code)) {
        errors.push({
          jobId,
          sheet: worksheet.name,
          rowNumber: r,
          field: 'code',
          message: `Baris ${r}: Kode item "${code}" duplikat dalam berkas spreadsheet.`,
        });
        continue;
      }
      seenCodesInFile.add(code);

      const rawBaseUnit = colBaseUnit ? ExcelParser.extractCellValue(row.getCell(colBaseUnit)) : null;
      const baseUnit = ImportNormalizer.normalizeText(rawBaseUnit) || 'TAB';

      const rawPackSize = colPackSize ? ExcelParser.extractCellValue(row.getCell(colPackSize)) : null;
      const packSize = ImportNormalizer.normalizeDecimal(rawPackSize) || '1';

      if (!ItemDomainRules.validatePackSize(packSize)) {
        errors.push({
          jobId,
          sheet: worksheet.name,
          rowNumber: r,
          field: 'pack_size',
          message: `Baris ${r}: Isi kemasan (pack_size) harus lebih besar dari 0.`,
        });
        continue;
      }

      const rawSafety = colSafety ? ExcelParser.extractCellValue(row.getCell(colSafety)) : null;
      const rawMin = colMin ? ExcelParser.extractCellValue(row.getCell(colMin)) : null;
      const safetyStock = ImportNormalizer.normalizeDecimal(rawSafety) || '0';
      const minStock = ImportNormalizer.normalizeDecimal(rawMin) || '0';

      if (!ItemDomainRules.validatePlanningParams({ safety_stock: safetyStock, min_stock: minStock })) {
        errors.push({
          jobId,
          sheet: worksheet.name,
          rowNumber: r,
          field: 'planning_params',
          message: `Baris ${r}: Nilai min_stock (${minStock}) harus >= safety_stock (${safetyStock}).`,
        });
        continue;
      }

      parsedRows.push({
        rowNumber: r,
        code,
        itemType: ImportNormalizer.normalizeItemType(
          colType ? ExcelParser.extractCellValue(row.getCell(colType)) : null,
        ),
        categoryCodeOrName:
          (colCategory
            ? ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(colCategory)))
            : null) || 'UMUM',
        genericName,
        brandName: colBrand
          ? ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(colBrand)))
          : null,
        dosageFormName: colDosage
          ? ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(colDosage)))
          : null,
        strength: colStrength
          ? ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(colStrength)))
          : null,
        atcCode: colAtc
          ? ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(colAtc)))
          : null,
        ddd: colDdd
          ? ImportNormalizer.normalizeDecimal(ExcelParser.extractCellValue(row.getCell(colDdd)))
          : null,
        baseUnitCode: baseUnit,
        purchaseUnitCode: colPurchaseUnit
          ? ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(colPurchaseUnit)))
          : null,
        packSize,
        catalogType: ImportNormalizer.normalizeCatalogType(
          colCatalog ? ExcelParser.extractCellValue(row.getCell(colCatalog)) : null,
        ),
        formularyStatus: ImportNormalizer.normalizeFormularyStatus(
          colFormulary ? ExcelParser.extractCellValue(row.getCell(colFormulary)) : null,
        ),
        fornasClass: ImportNormalizer.normalizeFornasClass(
          colFornas ? ExcelParser.extractCellValue(row.getCell(colFornas)) : null,
        ),
        referencePrice: colRefPrice
          ? ImportNormalizer.normalizeDecimal(ExcelParser.extractCellValue(row.getCell(colRefPrice)))
          : null,
        safetyStock,
        minStock,
      });
    }

    // Periksa duplikat kode terhadap database
    const existingCodes = await this.importRepository.findExistingItemCodes(
      parsedRows.map((p) => p.code),
    );

    const validRows: ParsedItemRow[] = [];
    for (const row of parsedRows) {
      if (existingCodes.has(row.code)) {
        errors.push({
          jobId,
          sheet: worksheet.name,
          rowNumber: row.rowNumber,
          field: 'code',
          message: `Baris ${row.rowNumber}: Kode item "${row.code}" sudah terdaftar di sistem.`,
        });
      } else {
        validRows.push(row);
      }
    }

    await this.importRepository.insertErrors(errors);

    return {
      totalRows: parsedRows.length + (errors.length - (parsedRows.length - validRows.length)),
      validRows: validRows.length,
      invalidRows: errors.length,
    };
  }

  private async validateOpeningBalance(
    jobId: string,
    buffer: Buffer,
  ): Promise<ImportJobSummary> {
    const worksheet = await ExcelParser.loadWorksheet(buffer);
    const { headerRowNumber, headerMap } = ExcelParser.findHeaderRow(worksheet, [
      'kodifikasi',
      'kode',
      'harga',
      'stok awal',
    ]);

    const errors: Array<{
      jobId: string;
      sheet?: string;
      rowNumber?: number;
      field?: string;
      message: string;
    }> = [];

    const colCode = headerMap.get('kodifikasi') || headerMap.get('kode') || 1;
    const colPrice = headerMap.get('harga per item') || headerMap.get('harga') || 2;
    const colTotalSheet = headerMap.get('total stok awal') || headerMap.get('total');

    // Temukan kolom-kolom lokasi
    const locations = await this.importRepository.findAllLocations();
    const locationMap = new Map<string, string>(); // code/name lowercase -> id
    for (const loc of locations) {
      locationMap.set(loc.code.toLowerCase(), loc.id);
      locationMap.set(loc.name.toLowerCase(), loc.id);
    }

    // Petakan kolom-kolom spreadsheet yang merupakan nama/kode lokasi
    const locationColumns: Array<{ colNumber: number; locationId: string; locationName: string }> =
      [];
    for (const [headerText, colNumber] of headerMap.entries()) {
      for (const loc of locations) {
        if (
          headerText.includes(loc.name.toLowerCase()) ||
          headerText.includes(loc.code.toLowerCase()) ||
          (loc.name.toLowerCase().includes('gudang') && headerText === 'gudang') ||
          (loc.name.toLowerCase().includes('rajal') && headerText.includes('rajal')) ||
          (loc.name.toLowerCase().includes('igd') && headerText === 'igd') ||
          (loc.name.toLowerCase().includes('hd') && headerText === 'hd') ||
          (loc.name.toLowerCase().includes('ranap') && headerText === 'ranap') ||
          (loc.name.toLowerCase().includes('ibs') && headerText === 'ibs')
        ) {
          if (!locationColumns.some((lc) => lc.locationId === loc.id)) {
            locationColumns.push({
              colNumber,
              locationId: loc.id,
              locationName: loc.name,
            });
          }
          break;
        }
      }
    }

    let totalSheetStock = new Decimal(0);
    let totalCalculatedStock = new Decimal(0);
    const mismatches: Array<{
      itemCode: string;
      sheetTotal: string;
      calculatedTotal: string;
      difference: string;
    }> = [];

    const parsedRows: ParsedOpeningBalanceRow[] = [];
    const priceSeqPerCode = new Map<string, number>();

    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const rawCode = ExcelParser.extractCellValue(row.getCell(colCode));
      const itemCode = ImportNormalizer.normalizeCode(rawCode);

      if (!itemCode) continue;

      const rawPrice = ExcelParser.extractCellValue(row.getCell(colPrice));
      const unitCost = ImportNormalizer.normalizeDecimal(rawPrice);

      if (!unitCost || new Decimal(unitCost).isNegative()) {
        errors.push({
          jobId,
          sheet: worksheet.name,
          rowNumber: r,
          field: 'unit_cost',
          message: `Baris ${r}: Harga pokok per batch (unit_cost) tidak valid untuk item ${itemCode}.`,
        });
        continue;
      }

      const seq = priceSeqPerCode.get(itemCode) || 1;
      priceSeqPerCode.set(itemCode, seq + 1);

      let rowStockSum = new Decimal(0);
      const locQtys: Array<{ locationCode: string; quantity: string }> = [];

      for (const locCol of locationColumns) {
        const rawQty = ExcelParser.extractCellValue(row.getCell(locCol.colNumber));
        const qty = ImportNormalizer.normalizeDecimal(rawQty);
        if (qty && new Decimal(qty).greaterThan(0)) {
          locQtys.push({
            locationCode: locCol.locationId,
            quantity: qty,
          });
          rowStockSum = rowStockSum.plus(new Decimal(qty));
        }
      }

      totalCalculatedStock = totalCalculatedStock.plus(rowStockSum);

      const rawSheetTotal = colTotalSheet
        ? ExcelParser.extractCellValue(row.getCell(colTotalSheet))
        : null;
      const sheetTotal = ImportNormalizer.normalizeDecimal(rawSheetTotal);

      if (sheetTotal) {
        const sheetDec = new Decimal(sheetTotal);
        totalSheetStock = totalSheetStock.plus(sheetDec);

        if (!sheetDec.equals(rowStockSum)) {
          mismatches.push({
            itemCode,
            sheetTotal: sheetDec.toFixed(3),
            calculatedTotal: rowStockSum.toFixed(3),
            difference: rowStockSum.minus(sheetDec).toFixed(3),
          });
        }
      }

      parsedRows.push({
        rowNumber: r,
        itemCode,
        legacyPriceSeq: seq,
        unitCost,
        sheetTotalStock: sheetTotal || rowStockSum.toString(),
        locationQuantities: locQtys,
      });
    }

    // Pastikan kode item ada di master items
    const existingCodes = await this.importRepository.findExistingItemCodes(
      parsedRows.map((p) => p.itemCode),
    );

    const validRows: ParsedOpeningBalanceRow[] = [];
    for (const row of parsedRows) {
      if (!existingCodes.has(row.itemCode)) {
        errors.push({
          jobId,
          sheet: worksheet.name,
          rowNumber: row.rowNumber,
          field: 'item_code',
          message: `Baris ${row.rowNumber}: Kode item "${row.itemCode}" belum terdaftar di master item.`,
        });
      } else {
        validRows.push(row);
      }
    }

    await this.importRepository.insertErrors(errors);

    return {
      totalRows: parsedRows.length,
      validRows: validRows.length,
      invalidRows: errors.length,
      reconciliation: {
        totalSheetStock: totalSheetStock.toFixed(3),
        totalCalculatedStock: totalCalculatedStock.toFixed(3),
        totalDifference: totalCalculatedStock.minus(totalSheetStock).toFixed(3),
        mismatches: mismatches.slice(0, 50),
      },
    };
  }

  private async validateSuppliers(jobId: string, buffer: Buffer): Promise<ImportJobSummary> {
    const worksheet = await ExcelParser.loadWorksheet(buffer);
    const { headerRowNumber } = ExcelParser.findHeaderRow(worksheet, ['nama', 'supplier']);
    const errors: Array<{ jobId: string; rowNumber: number; field: string; message: string }> = [];
    let count = 0;

    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const name = ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(1)));
      if (!name) continue;
      count++;
    }

    return { totalRows: count, validRows: count, invalidRows: errors.length };
  }

  private async validateLocations(jobId: string, buffer: Buffer): Promise<ImportJobSummary> {
    const worksheet = await ExcelParser.loadWorksheet(buffer);
    const { headerRowNumber } = ExcelParser.findHeaderRow(worksheet, ['lokasi', 'nama']);
    let count = 0;

    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const name = ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(1)));
      if (!name) continue;
      count++;
    }

    return { totalRows: count, validRows: count, invalidRows: 0 };
  }

  // ---------------------------------------------------------------------------
  // Eksekusi Impor
  // ---------------------------------------------------------------------------

  private async executeItemsImport(
    jobId: string,
    buffer: Buffer,
    userId: string,
  ): Promise<number> {
    const worksheet = await ExcelParser.loadWorksheet(buffer);
    const { headerRowNumber, headerMap } = ExcelParser.findHeaderRow(worksheet, [
      'kodifikasi',
      'kode',
      'nama',
      'generik',
    ]);

    const colCode = headerMap.get('kodifikasi') || headerMap.get('kode') || 1;
    const colName =
      headerMap.get('nama obat (generik) / (merk)') ||
      headerMap.get('nama generik') ||
      headerMap.get('nama') ||
      2;
    const colBrand = headerMap.get('nama obat (merk)') || headerMap.get('merk');
    const colType = headerMap.get('kategori (obat / bmhp)') || headerMap.get('jenis');
    const colCategory =
      headerMap.get('sub sub kategori format') ||
      headerMap.get('sub kategori format') ||
      headerMap.get('kategori');
    const colDosage = headerMap.get('bentuk sediaan');
    const colStrength = headerMap.get('kekuatan');
    const colAtc = headerMap.get('atc');
    const colDdd = headerMap.get('ddd');
    const colBaseUnit = headerMap.get('satuan kecil') || headerMap.get('satuan');
    const colPurchaseUnit = headerMap.get('satuan besar');
    const colPackSize = headerMap.get('kemasan') || headerMap.get('isi kemasan');
    const colCatalog = headerMap.get('ekatalog / non ekatalog') || headerMap.get('katalog');
    const colFormulary = headerMap.get('formularium rs / non formularium rs');
    const colFornas = headerMap.get('generik/non generik fornas');
    const colRefPrice =
      headerMap.get('harga per item') || headerMap.get('harga perencanaan') || headerMap.get('harga');
    const colSafety = headerMap.get('safety stok');
    const colMin = headerMap.get('min');

    // Ambil master referensi
    const units = await this.importRepository.findAllUnits();
    const categories = await this.importRepository.findAllCategories();
    const dosageForms = await this.importRepository.findAllDosageForms();

    const unitMap = new Map(units.map((u) => [u.code.toUpperCase(), u.id]));
    const defaultUnitId = units[0]?.id || generateUuidV7();

    const categoryMap = new Map(categories.map((c) => [c.code.toUpperCase(), c.id]));
    const defaultCategoryId = categories[0]?.id || generateUuidV7();

    const dosageMap = new Map(dosageForms.map((d) => [d.name.toLowerCase(), d.id]));

    // Kumpulkan baris yang valid
    const itemsToInsert: Array<any> = [];
    const planningParamsToInsert: Array<any> = [];

    // Hindari item yang sudah ada
    const allCodesInFile: string[] = [];
    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      const code = ImportNormalizer.normalizeCode(
        ExcelParser.extractCellValue(worksheet.getRow(r).getCell(colCode)),
      );
      if (code) allCodesInFile.push(code);
    }

    const existingCodes = await this.importRepository.findExistingItemCodes(allCodesInFile);
    const seen = new Set<string>();

    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const code = ImportNormalizer.normalizeCode(ExcelParser.extractCellValue(row.getCell(colCode)));
      if (!code || existingCodes.has(code) || seen.has(code)) continue;

      const genericName = ImportNormalizer.normalizeText(
        ExcelParser.extractCellValue(row.getCell(colName)),
      );
      if (!genericName) continue;

      seen.add(code);
      const itemId = generateUuidV7();

      const baseUnitText = colBaseUnit
        ? ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(colBaseUnit)))
        : null;
      const baseUnitId = (baseUnitText && unitMap.get(baseUnitText.toUpperCase())) || defaultUnitId;

      const purchaseUnitText = colPurchaseUnit
        ? ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(colPurchaseUnit)))
        : null;
      const purchaseUnitId = purchaseUnitText
        ? unitMap.get(purchaseUnitText.toUpperCase()) || null
        : null;

      const categoryText = colCategory
        ? ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(colCategory)))
        : null;
      const categoryId =
        (categoryText && categoryMap.get(categoryText.toUpperCase())) || defaultCategoryId;

      const dosageText = colDosage
        ? ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(colDosage)))
        : null;
      const dosageId = (dosageText && dosageMap.get(dosageText.toLowerCase())) || null;

      const packSize =
        (colPackSize
          ? ImportNormalizer.normalizeDecimal(ExcelParser.extractCellValue(row.getCell(colPackSize)))
          : null) || '1';

      const safetyStock =
        (colSafety
          ? ImportNormalizer.normalizeDecimal(ExcelParser.extractCellValue(row.getCell(colSafety)))
          : null) || '0';
      const minStock =
        (colMin
          ? ImportNormalizer.normalizeDecimal(ExcelParser.extractCellValue(row.getCell(colMin)))
          : null) || '0';

      itemsToInsert.push({
        id: itemId,
        code,
        item_type: ImportNormalizer.normalizeItemType(
          colType ? ExcelParser.extractCellValue(row.getCell(colType)) : null,
        ),
        category_id: categoryId,
        generic_name: genericName,
        brand_name: colBrand
          ? ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(colBrand)))
          : null,
        dosage_form_id: dosageId,
        strength: colStrength
          ? ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(colStrength)))
          : null,
        atc_code: colAtc
          ? ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(colAtc)))
          : null,
        ddd: colDdd
          ? ImportNormalizer.normalizeDecimal(ExcelParser.extractCellValue(row.getCell(colDdd)))
          : null,
        base_unit_id: baseUnitId,
        purchase_unit_id: purchaseUnitId,
        pack_size: packSize,
        catalog_type: ImportNormalizer.normalizeCatalogType(
          colCatalog ? ExcelParser.extractCellValue(row.getCell(colCatalog)) : null,
        ),
        formulary_status: ImportNormalizer.normalizeFormularyStatus(
          colFormulary ? ExcelParser.extractCellValue(row.getCell(colFormulary)) : null,
        ),
        fornas_class: ImportNormalizer.normalizeFornasClass(
          colFornas ? ExcelParser.extractCellValue(row.getCell(colFornas)) : null,
        ),
        reference_price: colRefPrice
          ? ImportNormalizer.normalizeDecimal(ExcelParser.extractCellValue(row.getCell(colRefPrice)))
          : null,
        is_active: true,
        legacy_ref: { jobId, rowNumber: r },
        created_by: userId,
      });

      planningParamsToInsert.push({
        item_id: itemId,
        safety_stock: safetyStock,
        min_stock: minStock,
        moving_class: null,
        purchase_notes: null,
      });
    }

    await this.unitOfWork.run(async (tx) => {
      await this.importRepository.insertItems(itemsToInsert, tx);
      await this.importRepository.insertPlanningParams(planningParamsToInsert, tx);

      // Terbitkan event outbox untuk invalidasi cache master
      await this.outboxService.publish(
        {
          aggregateType: 'master',
          aggregateId: jobId,
          eventType: 'master.cache.invalidate',
          payload: { reason: 'import_items', count: itemsToInsert.length },
        },
        tx,
      );
    });

    return itemsToInsert.length;
  }

  private async executeOpeningBalanceImport(
    jobId: string,
    buffer: Buffer,
    userId: string,
  ): Promise<number> {
    const worksheet = await ExcelParser.loadWorksheet(buffer);
    const { headerRowNumber, headerMap } = ExcelParser.findHeaderRow(worksheet, [
      'kodifikasi',
      'kode',
      'harga',
      'stok awal',
    ]);

    const colCode = headerMap.get('kodifikasi') || headerMap.get('kode') || 1;
    const colPrice = headerMap.get('harga per item') || headerMap.get('harga') || 2;

    const locations = await this.importRepository.findAllLocations();
    const locationColumns: Array<{ colNumber: number; locationId: string }> = [];

    for (const [headerText, colNumber] of headerMap.entries()) {
      for (const loc of locations) {
        if (
          loc.holds_stock &&
          loc.is_active &&
          (headerText.includes(loc.name.toLowerCase()) ||
            headerText.includes(loc.code.toLowerCase()) ||
            (loc.name.toLowerCase().includes('gudang') && headerText === 'gudang') ||
            (loc.name.toLowerCase().includes('rajal') && headerText.includes('rajal')) ||
            (loc.name.toLowerCase().includes('igd') && headerText === 'igd') ||
            (loc.name.toLowerCase().includes('hd') && headerText === 'hd') ||
            (loc.name.toLowerCase().includes('ranap') && headerText === 'ranap') ||
            (loc.name.toLowerCase().includes('ibs') && headerText === 'ibs'))
        ) {
          if (!locationColumns.some((lc) => lc.locationId === loc.id)) {
            locationColumns.push({ colNumber, locationId: loc.id });
          }
          break;
        }
      }
    }

    // Ambil item id berdasarkan kode
    const allCodesInFile: string[] = [];
    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      const code = ImportNormalizer.normalizeCode(
        ExcelParser.extractCellValue(worksheet.getRow(r).getCell(colCode)),
      );
      if (code) allCodesInFile.push(code);
    }

    const itemRows = await this.unitOfWork.run(async (tx) => {
      return await tx
        .selectFrom('items')
        .select(['id', 'code'])
        .where('code', 'in', allCodesInFile)
        .execute();
    });
    const itemCodeToId = new Map(itemRows.map((i) => [i.code, i.id]));

    const postingLines: Array<{
      itemId: string;
      locationId: string;
      batchNumber: string;
      unitCost: string;
      movementType: 'opening';
      quantity: string;
      isLegacy: boolean;
      legacyPriceSeq: number;
    }> = [];

    const priceSeqPerCode = new Map<string, number>();

    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const code = ImportNormalizer.normalizeCode(ExcelParser.extractCellValue(row.getCell(colCode)));
      const itemId = code ? itemCodeToId.get(code) : undefined;
      if (!itemId || !code) continue;

      const rawPrice = ExcelParser.extractCellValue(row.getCell(colPrice));
      const unitCost = ImportNormalizer.normalizeDecimal(rawPrice);
      if (!unitCost || new Decimal(unitCost).isNegative()) continue;

      const seq = priceSeqPerCode.get(code) || 1;
      priceSeqPerCode.set(code, seq + 1);
      const batchNumber = `LEGACY-${seq}`;

      for (const locCol of locationColumns) {
        const rawQty = ExcelParser.extractCellValue(row.getCell(locCol.colNumber));
        const qty = ImportNormalizer.normalizeDecimal(rawQty);
        if (qty && new Decimal(qty).greaterThan(0)) {
          postingLines.push({
            itemId,
            locationId: locCol.locationId,
            batchNumber,
            unitCost,
            movementType: 'opening',
            quantity: qty,
            isLegacy: true,
            legacyPriceSeq: seq,
          });
        }
      }
    }

    if (postingLines.length === 0) {
      return 0;
    }

    // Jalankan posting saldo awal via PostingService (per chunk misal 500 baris)
    const chunkSize = 200;
    let totalPostedLines = 0;

    for (let i = 0; i < postingLines.length; i += chunkSize) {
      const chunk = postingLines.slice(i, i + chunkSize);
      await this.postingService.post({
        documentType: 'opening',
        documentId: jobId,
        actorId: userId,
        lines: chunk,
      });
      totalPostedLines += chunk.length;
    }

    return totalPostedLines;
  }

  private async executeSuppliersImport(
    jobId: string,
    buffer: Buffer,
    userId: string,
  ): Promise<number> {
    const worksheet = await ExcelParser.loadWorksheet(buffer);
    const { headerRowNumber } = ExcelParser.findHeaderRow(worksheet, ['nama', 'supplier']);
    const suppliers: any[] = [];

    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const name = ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(1)));
      if (!name) continue;

      const code =
        ImportNormalizer.normalizeCode(ExcelParser.extractCellValue(row.getCell(2))) ||
        `SUPP-${generateUuidV7().substring(0, 8).toUpperCase()}`;

      suppliers.push({
        id: generateUuidV7(),
        code,
        name,
        supplier_type: 'distributor',
        is_active: true,
        created_by: userId,
      });
    }

    await this.unitOfWork.run(async (tx) => {
      await this.importRepository.insertSuppliers(suppliers, tx);
    });

    return suppliers.length;
  }

  private async executeLocationsImport(
    jobId: string,
    buffer: Buffer,
    _userId: string,
  ): Promise<number> {
    const worksheet = await ExcelParser.loadWorksheet(buffer);
    const { headerRowNumber } = ExcelParser.findHeaderRow(worksheet, ['lokasi', 'nama']);
    const locations: any[] = [];

    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const name = ImportNormalizer.normalizeText(ExcelParser.extractCellValue(row.getCell(1)));
      if (!name) continue;

      const code =
        ImportNormalizer.normalizeCode(ExcelParser.extractCellValue(row.getCell(2))) ||
        `LOC-${generateUuidV7().substring(0, 8).toUpperCase()}`;

      locations.push({
        id: generateUuidV7(),
        code,
        name,
        location_type: 'ruangan',
        holds_stock: false,
        is_active: true,
      });
    }

    await this.unitOfWork.run(async (tx) => {
      await this.importRepository.insertLocations(locations, tx);
    });

    return locations.length;
  }
}
