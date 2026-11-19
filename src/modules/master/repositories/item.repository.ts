import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';
import { KYSELY } from '../../../infrastructure/database/database.service';
import { generateUuidV7 } from '../../../common/utils/uuid';
import { ItemQueryDto, UpdatePlanningParamsDto } from '../dto/item.dto';

@Injectable()
export class ItemRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async findAll(query: ItemQueryDto) {
    let qb = this.db
      .selectFrom('items as i')
      .leftJoin('item_categories as c', 'c.id', 'i.category_id')
      .leftJoin('units as bu', 'bu.id', 'i.base_unit_id')
      .leftJoin('units as pu', 'pu.id', 'i.purchase_unit_id')
      .leftJoin('dosage_forms as df', 'df.id', 'i.dosage_form_id')
      .leftJoin('item_planning_params as pp', 'pp.item_id', 'i.id')
      .select([
        'i.id',
        'i.code',
        'i.item_type',
        'i.generic_name',
        'i.brand_name',
        'i.strength',
        'i.atc_code',
        'i.ddd',
        'i.pack_size',
        'i.catalog_type',
        'i.formulary_status',
        'i.fornas_class',
        'i.reference_price',
        'i.is_active',
        'i.created_at',
        'i.updated_at',
        'c.id as category_id',
        'c.name as category_name',
        'bu.id as base_unit_id',
        'bu.name as base_unit_name',
        'pu.id as purchase_unit_id',
        'pu.name as purchase_unit_name',
        'df.id as dosage_form_id',
        'df.name as dosage_form_name',
        'pp.safety_stock',
        'pp.min_stock',
        'pp.moving_class',
        'pp.purchase_note',
      ])
      .where('i.deleted_at', 'is', null);

    if (query.type) {
      qb = qb.where('i.item_type', '=', query.type);
    }

    if (query.category_id) {
      qb = qb.where('i.category_id', '=', query.category_id);
    }

    if (query.is_active !== undefined) {
      qb = qb.where('i.is_active', '=', query.is_active);
    }

    if (query.q && query.q.trim()) {
      const searchTerm = `%${query.q.trim()}%`;
      qb = qb.where((eb) =>
        eb.or([
          eb('i.code', 'ilike', searchTerm),
          eb('i.generic_name', 'ilike', searchTerm),
          eb('i.brand_name', 'ilike', searchTerm),
          eb('i.strength', 'ilike', searchTerm),
        ]),
      );
    }

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    return await qb
      .orderBy('i.generic_name', 'asc')
      .limit(limit)
      .offset(offset)
      .execute();
  }

  async findById(id: string) {
    return await this.db
      .selectFrom('items as i')
      .leftJoin('item_categories as c', 'c.id', 'i.category_id')
      .leftJoin('units as bu', 'bu.id', 'i.base_unit_id')
      .leftJoin('units as pu', 'pu.id', 'i.purchase_unit_id')
      .leftJoin('dosage_forms as df', 'df.id', 'i.dosage_form_id')
      .leftJoin('item_planning_params as pp', 'pp.item_id', 'i.id')
      .select([
        'i.id',
        'i.code',
        'i.item_type',
        'i.generic_name',
        'i.brand_name',
        'i.strength',
        'i.atc_code',
        'i.ddd',
        'i.pack_size',
        'i.catalog_type',
        'i.formulary_status',
        'i.fornas_class',
        'i.reference_price',
        'i.is_active',
        'i.created_at',
        'i.updated_at',
        'c.id as category_id',
        'c.name as category_name',
        'bu.id as base_unit_id',
        'bu.name as base_unit_name',
        'pu.id as purchase_unit_id',
        'pu.name as purchase_unit_name',
        'df.id as dosage_form_id',
        'df.name as dosage_form_name',
        'pp.safety_stock',
        'pp.min_stock',
        'pp.moving_class',
        'pp.purchase_note',
      ])
      .where('i.id', '=', id)
      .where('i.deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async findByCode(code: string) {
    return await this.db
      .selectFrom('items')
      .selectAll()
      .where('code', '=', code)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async create(item: {
    code: string;
    item_type: 'obat' | 'bmhp';
    category_id: string;
    generic_name: string;
    brand_name?: string | null;
    dosage_form_id?: string | null;
    strength?: string | null;
    atc_code?: string | null;
    ddd?: number | null;
    base_unit_id: string;
    purchase_unit_id?: string | null;
    pack_size?: number;
    catalog_type?: 'ekatalog' | 'non_ekatalog';
    formulary_status?: 'formularium' | 'non_formularium' | null;
    fornas_class?: 'fornas_generik' | 'fornas_non_generik' | 'non_fornas_non_generik' | null;
    reference_price?: number | null;
    created_by?: string | null;
  }) {
    const id = generateUuidV7();
    const [created] = await this.db
      .insertInto('items')
      .values({
        id,
        code: item.code,
        item_type: item.item_type,
        category_id: item.category_id,
        generic_name: item.generic_name,
        brand_name: item.brand_name || null,
        dosage_form_id: item.dosage_form_id || null,
        strength: item.strength || null,
        atc_code: item.atc_code || null,
        ddd: item.ddd !== undefined ? item.ddd : null,
        base_unit_id: item.base_unit_id,
        purchase_unit_id: item.purchase_unit_id || null,
        pack_size: item.pack_size ?? 1,
        catalog_type: item.catalog_type ?? 'ekatalog',
        formulary_status: item.formulary_status || null,
        fornas_class: item.fornas_class || null,
        reference_price: item.reference_price !== undefined ? item.reference_price : null,
        created_by: item.created_by || null,
      })
      .returningAll()
      .execute();

    return created;
  }

  async update(id: string, updates: Partial<any>) {
    const [updated] = await this.db
      .updateTable('items')
      .set({
        ...updates,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .execute();

    return updated;
  }

  async getItemTotalStock(itemId: string): Promise<string> {
    const res = await this.db
      .selectFrom('stock_balances')
      .select((eb) => eb.fn.sum<string>('quantity').as('total_qty'))
      .where('item_id', '=', itemId)
      .executeTakeFirst();

    return res?.total_qty || '0';
  }

  async upsertPlanningParams(
    itemId: string,
    params: UpdatePlanningParamsDto,
    updatedBy?: string,
  ) {
    await sql`
      INSERT INTO item_planning_params (
        item_id, safety_stock, min_stock, moving_class, moving_class_is_manual,
        moving_class_updated_at, purchase_note, updated_by, updated_at
      ) VALUES (
        ${itemId}, ${params.safety_stock}, ${params.min_stock}, ${params.moving_class || null},
        ${params.moving_class ? true : false},
        ${params.moving_class ? new Date() : null},
        ${params.purchase_note || null},
        ${updatedBy || null},
        now()
      )
      ON CONFLICT (item_id) DO UPDATE SET
        safety_stock = EXCLUDED.safety_stock,
        min_stock = EXCLUDED.min_stock,
        moving_class = EXCLUDED.moving_class,
        moving_class_is_manual = EXCLUDED.moving_class_is_manual,
        moving_class_updated_at = EXCLUDED.moving_class_updated_at,
        purchase_note = EXCLUDED.purchase_note,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
    `.execute(this.db);
  }
}
