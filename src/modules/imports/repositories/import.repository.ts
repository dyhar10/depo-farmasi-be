import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';
import { KYSELY } from '../../../infrastructure/database/database.service';
import { DatabaseTransaction } from '../../../infrastructure/database/unit-of-work';
import { generateUuidV7 } from '../../../common/utils/uuid';
import {
  ImportJobEntity,
  ImportJobErrorEntity,
  ImportType,
  ImportJobStatus,
  ImportJobSummary,
} from '../domain/import.entity';

@Injectable()
export class ImportRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async createJob(
    data: {
      importType: ImportType;
      filename: string;
      fileSha256: string;
      dryRun: boolean;
      status: ImportJobStatus;
      summary: ImportJobSummary;
      createdBy?: string | null;
    },
    tx?: DatabaseTransaction,
  ): Promise<ImportJobEntity> {
    const executor = tx || this.db;
    const id = generateUuidV7();

    const row = await executor
      .insertInto('import_jobs')
      .values({
        id,
        import_type: data.importType,
        filename: data.filename,
        file_sha256: data.fileSha256,
        status: data.status,
        dry_run: data.dryRun,
        summary: JSON.stringify(data.summary),
        created_by: data.createdBy || null,
        created_at: new Date(),
        finished_at: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: row.id,
      importType: row.import_type,
      filename: row.filename,
      fileSha256: row.file_sha256,
      status: row.status,
      dryRun: row.dry_run,
      summary: typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary,
      createdBy: row.created_by,
      createdAt: row.created_at,
      finishedAt: row.finished_at ? new Date(row.finished_at) : null,
    };
  }

  async findJobById(id: string, tx?: DatabaseTransaction): Promise<ImportJobEntity | null> {
    const executor = tx || this.db;
    const row = await executor
      .selectFrom('import_jobs')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;

    return {
      id: row.id,
      importType: row.import_type,
      filename: row.filename,
      fileSha256: row.file_sha256,
      status: row.status,
      dryRun: row.dry_run,
      summary: typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary,
      createdBy: row.created_by,
      createdAt: row.created_at,
      finishedAt: row.finished_at ? new Date(row.finished_at) : null,
    };
  }

  async findJobByHash(fileSha256: string, importType: ImportType): Promise<ImportJobEntity | null> {
    const row = await this.db
      .selectFrom('import_jobs')
      .selectAll()
      .where('file_sha256', '=', fileSha256)
      .where('import_type', '=', importType)
      .where('status', '=', 'completed')
      .orderBy('created_at', 'desc')
      .executeTakeFirst();

    if (!row) return null;

    return {
      id: row.id,
      importType: row.import_type,
      filename: row.filename,
      fileSha256: row.file_sha256,
      status: row.status,
      dryRun: row.dry_run,
      summary: typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary,
      createdBy: row.created_by,
      createdAt: row.created_at,
      finishedAt: row.finished_at ? new Date(row.finished_at) : null,
    };
  }

  async updateJob(
    id: string,
    data: {
      status?: ImportJobStatus;
      dryRun?: boolean;
      summary?: ImportJobSummary;
      finishedAt?: Date | null;
    },
    tx?: DatabaseTransaction,
  ): Promise<void> {
    const executor = tx || this.db;
    const updateData: Record<string, any> = {};

    if (data.status) updateData.status = data.status;
    if (data.dryRun !== undefined) updateData.dry_run = data.dryRun;
    if (data.summary) updateData.summary = JSON.stringify(data.summary);
    if (data.finishedAt !== undefined) updateData.finished_at = data.finishedAt;

    await executor
      .updateTable('import_jobs')
      .set(updateData)
      .where('id', '=', id)
      .execute();
  }

  async insertErrors(
    errors: Array<{
      jobId: string;
      sheet?: string | null;
      rowNumber?: number | null;
      field?: string | null;
      message: string;
    }>,
    tx?: DatabaseTransaction,
  ): Promise<void> {
    if (errors.length === 0) return;
    const executor = tx || this.db;

    // Masukkan dalam batch (misal per 500)
    const chunkSize = 500;
    for (let i = 0; i < errors.length; i += chunkSize) {
      const chunk = errors.slice(i, i + chunkSize);
      await executor
        .insertInto('import_job_errors')
        .values(
          chunk.map((e) => ({
            id: generateUuidV7(),
            job_id: e.jobId,
            sheet: e.sheet || null,
            row_number: e.rowNumber || null,
            field: e.field || null,
            message: e.message,
          })),
        )
        .execute();
    }
  }

  async findJobErrors(jobId: string): Promise<ImportJobErrorEntity[]> {
    const rows = await this.db
      .selectFrom('import_job_errors')
      .selectAll()
      .where('job_id', '=', jobId)
      .orderBy('row_number', 'asc')
      .execute();

    return rows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      sheet: r.sheet,
      rowNumber: r.row_number,
      field: r.field,
      message: r.message,
    }));
  }

  // Helper lookup master data
  async findExistingItemCodes(codes: string[], tx?: DatabaseTransaction): Promise<Set<string>> {
    if (codes.length === 0) return new Set();
    const executor = tx || this.db;
    const rows = await executor
      .selectFrom('items')
      .select('code')
      .where('code', 'in', codes)
      .execute();

    return new Set(rows.map((r) => r.code));
  }

  async findAllUnits(tx?: DatabaseTransaction) {
    const executor = tx || this.db;
    return await executor.selectFrom('units').select(['id', 'code', 'name']).execute();
  }

  async findAllCategories(tx?: DatabaseTransaction) {
    const executor = tx || this.db;
    return await executor
      .selectFrom('item_categories')
      .select(['id', 'code', 'name', 'level', 'item_type'])
      .execute();
  }

  async findAllDosageForms(tx?: DatabaseTransaction) {
    const executor = tx || this.db;
    return await executor.selectFrom('dosage_forms').select(['id', 'name']).execute();
  }

  async findAllLocations(tx?: DatabaseTransaction) {
    const executor = tx || this.db;
    return await executor
      .selectFrom('locations')
      .select(['id', 'code', 'name', 'holds_stock', 'is_active', 'location_type'])
      .execute();
  }

  async findAllSuppliers(tx?: DatabaseTransaction) {
    const executor = tx || this.db;
    return await executor.selectFrom('suppliers').select(['id', 'code', 'name']).execute();
  }

  async insertItems(
    items: Array<{
      id: string;
      code: string;
      item_type: 'obat' | 'bmhp';
      category_id: string;
      generic_name: string;
      brand_name?: string | null;
      dosage_form_id?: string | null;
      strength?: string | null;
      atc_code?: string | null;
      ddd?: string | null;
      base_unit_id: string;
      purchase_unit_id?: string | null;
      pack_size: string;
      catalog_type: 'ekatalog' | 'non_ekatalog';
      formulary_status?: 'formularium' | 'non_formularium' | null;
      fornas_class?: 'fornas_generik' | 'fornas_non_generik' | 'non_fornas_non_generik' | null;
      reference_price?: string | null;
      is_active: boolean;
      legacy_ref?: string | null;
      created_by?: string | null;
    }>,
    tx: DatabaseTransaction,
  ): Promise<void> {
    if (items.length === 0) return;
    const chunkSize = 200;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      await tx
        .insertInto('items')
        .values(
          chunk.map((item) => ({
            id: item.id,
            code: item.code,
            item_type: item.item_type,
            category_id: item.category_id,
            generic_name: item.generic_name,
            brand_name: item.brand_name || null,
            dosage_form_id: item.dosage_form_id || null,
            strength: item.strength || null,
            atc_code: item.atc_code || null,
            ddd: item.ddd || null,
            base_unit_id: item.base_unit_id,
            purchase_unit_id: item.purchase_unit_id || null,
            pack_size: item.pack_size,
            catalog_type: item.catalog_type,
            formulary_status: item.formulary_status || null,
            fornas_class: item.fornas_class || null,
            reference_price: item.reference_price || null,
            is_active: item.is_active,
            legacy_ref: item.legacy_ref ? JSON.stringify(item.legacy_ref) : null,
            created_by: item.created_by || null,
            created_at: new Date(),
            updated_at: new Date(),
          })),
        )
        .execute();
    }
  }

  async insertPlanningParams(
    params: Array<{
      item_id: string;
      safety_stock: string;
      min_stock: string;
      moving_class?: 'slow' | 'fast_1' | 'fast_2' | 'non_moving' | null;
      purchase_note?: string | null;
    }>,
    tx: DatabaseTransaction,
  ): Promise<void> {
    if (params.length === 0) return;
    const chunkSize = 200;
    for (let i = 0; i < params.length; i += chunkSize) {
      const chunk = params.slice(i, i + chunkSize);
      await tx
        .insertInto('item_planning_params')
        .values(
          chunk.map((p) => ({
            item_id: p.item_id,
            safety_stock: p.safety_stock,
            min_stock: p.min_stock,
            moving_class: p.moving_class || null,
            purchase_note: p.purchase_note || null,
            updated_at: new Date(),
          })),
        )
        .onConflict((oc) =>
          oc.column('item_id').doUpdateSet({
            safety_stock: (eb: any) => eb.ref('excluded.safety_stock'),
            min_stock: (eb: any) => eb.ref('excluded.min_stock'),
            purchase_note: (eb: any) => eb.ref('excluded.purchase_note'),
            updated_at: new Date(),
          }),
        )
        .execute();
    }
  }

  async insertSuppliers(
    suppliers: Array<{
      id: string;
      code: string;
      name: string;
      supplier_type: 'penyedia' | 'distributor' | 'donor' | 'lainnya';
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      is_active: boolean;
      created_by?: string | null;
    }>,
    tx: DatabaseTransaction,
  ): Promise<void> {
    if (suppliers.length === 0) return;
    for (const s of suppliers) {
      await tx
        .insertInto('suppliers')
        .values({
          id: s.id,
          code: s.code,
          name: s.name,
          supplier_type: s.supplier_type,
          contact: JSON.stringify({
            phone: s.phone || null,
            email: s.email || null,
            address: s.address || null,
          }),
          is_active: s.is_active,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict((oc) => oc.column('code').doNothing())
        .execute();
    }
  }

  async insertLocations(
    locations: Array<{
      id: string;
      code: string;
      name: string;
      location_type:
        | 'gudang'
        | 'depo'
        | 'ruangan'
        | 'inventaris'
        | 'troli_emergensi'
        | 'laboratorium'
        | 'radiologi'
        | 'lainnya';
      holds_stock: boolean;
      is_active: boolean;
      parent_id?: string | null;
    }>,
    tx: DatabaseTransaction,
  ): Promise<void> {
    if (locations.length === 0) return;
    for (const l of locations) {
      await tx
        .insertInto('locations')
        .values({
          id: l.id,
          code: l.code,
          name: l.name,
          location_type: l.location_type,
          holds_stock: l.holds_stock,
          is_active: l.is_active,
          parent_id: l.parent_id || null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict((oc) => oc.column('code').doNothing())
        .execute();
    }
  }
}
