import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';
import { KYSELY } from '../../../infrastructure/database/database.service';
import { generateUuidV7 } from '../../../common/utils/uuid';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/category.dto';

@Injectable()
export class CategoryRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async findAll() {
    return await this.db
      .selectFrom('item_categories')
      .selectAll()
      .orderBy('level', 'asc')
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
      .execute();
  }

  async findById(id: string) {
    return await this.db
      .selectFrom('item_categories')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async findByCode(code: string) {
    return await this.db
      .selectFrom('item_categories')
      .selectAll()
      .where('code', '=', code)
      .executeTakeFirst();
  }

  async create(dto: CreateCategoryDto) {
    const id = generateUuidV7();
    const [created] = await this.db
      .insertInto('item_categories')
      .values({
        id,
        parent_id: dto.parent_id || null,
        item_type: dto.item_type,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        level: dto.level,
        sort_order: dto.sort_order ?? 0,
        is_active: true,
      })
      .returningAll()
      .execute();

    return created;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const updates: any = {};
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.sort_order !== undefined) updates.sort_order = dto.sort_order;
    if (dto.is_active !== undefined) updates.is_active = dto.is_active;

    const [updated] = await this.db
      .updateTable('item_categories')
      .set({
        ...updates,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .execute();

    return updated;
  }
}
