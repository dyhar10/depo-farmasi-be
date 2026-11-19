import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';
import { KYSELY } from '../../../infrastructure/database/database.service';
import { generateUuidV7 } from '../../../common/utils/uuid';
import { CreateSupplierDto, UpdateSupplierDto } from '../dto/supplier.dto';

@Injectable()
export class SupplierRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async findAll() {
    return await this.db
      .selectFrom('suppliers')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('name', 'asc')
      .execute();
  }

  async findById(id: string) {
    return await this.db
      .selectFrom('suppliers')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async findByCode(code: string) {
    return await this.db
      .selectFrom('suppliers')
      .selectAll()
      .where('code', '=', code)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async create(dto: CreateSupplierDto) {
    const id = generateUuidV7();
    const [created] = await this.db
      .insertInto('suppliers')
      .values({
        id,
        code: dto.code ? dto.code.trim().toUpperCase() : null,
        name: dto.name.trim(),
        supplier_type: dto.supplier_type,
        contact: dto.contact ? JSON.stringify(dto.contact) : JSON.stringify({}),
        is_active: true,
      })
      .returningAll()
      .execute();

    return created;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const updates: any = {};
    if (dto.code !== undefined) updates.code = dto.code ? dto.code.trim().toUpperCase() : null;
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.supplier_type !== undefined) updates.supplier_type = dto.supplier_type;
    if (dto.contact !== undefined) updates.contact = JSON.stringify(dto.contact);
    if (dto.is_active !== undefined) updates.is_active = dto.is_active;

    const [updated] = await this.db
      .updateTable('suppliers')
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
      .updateTable('suppliers')
      .set({
        is_active: false,
        deleted_at: new Date(),
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .execute();
  }
}
