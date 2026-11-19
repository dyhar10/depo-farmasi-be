import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';
import { KYSELY } from '../../../infrastructure/database/database.service';
import { generateUuidV7 } from '../../../common/utils/uuid';
import { CreateLocationDto, UpdateLocationDto } from '../dto/location.dto';

@Injectable()
export class LocationRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async findAll() {
    return await this.db
      .selectFrom('locations')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('location_type', 'asc')
      .orderBy('name', 'asc')
      .execute();
  }

  async findById(id: string) {
    return await this.db
      .selectFrom('locations')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async findByCode(code: string) {
    return await this.db
      .selectFrom('locations')
      .selectAll()
      .where('code', '=', code)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async create(dto: CreateLocationDto) {
    const id = generateUuidV7();
    const [created] = await this.db
      .insertInto('locations')
      .values({
        id,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        location_type: dto.location_type,
        parent_id: dto.parent_id || null,
        holds_stock: dto.holds_stock ?? true,
        is_active: true,
      })
      .returningAll()
      .execute();

    return created;
  }

  async update(id: string, dto: UpdateLocationDto) {
    const updates: any = {};
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.location_type !== undefined) updates.location_type = dto.location_type;
    if (dto.parent_id !== undefined) updates.parent_id = dto.parent_id;
    if (dto.holds_stock !== undefined) updates.holds_stock = dto.holds_stock;
    if (dto.is_active !== undefined) updates.is_active = dto.is_active;

    const [updated] = await this.db
      .updateTable('locations')
      .set({
        ...updates,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .execute();

    return updated;
  }

  async delete(id: string) {
    await this.db
      .updateTable('locations')
      .set({
        is_active: false,
        deleted_at: new Date(),
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .execute();
  }
}
