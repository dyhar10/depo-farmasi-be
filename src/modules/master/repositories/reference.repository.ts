import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';
import { KYSELY } from '../../../infrastructure/database/database.service';
import { generateUuidV7 } from '../../../common/utils/uuid';
import {
  CreateDosageFormDto,
  CreateUnitDto,
  UpdateDosageFormDto,
  UpdateUnitDto,
} from '../dto/reference.dto';

@Injectable()
export class ReferenceRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  // Units
  async findAllUnits() {
    return await this.db.selectFrom('units').selectAll().orderBy('name', 'asc').execute();
  }

  async findUnitById(id: string) {
    return await this.db.selectFrom('units').selectAll().where('id', '=', id).executeTakeFirst();
  }

  async findUnitByCode(code: string) {
    return await this.db.selectFrom('units').selectAll().where('code', '=', code).executeTakeFirst();
  }

  async createUnit(dto: CreateUnitDto) {
    const id = generateUuidV7();
    const [created] = await this.db
      .insertInto('units')
      .values({
        id,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
      })
      .returningAll()
      .execute();
    return created;
  }

  async updateUnit(id: string, dto: UpdateUnitDto) {
    const updates: any = {};
    if (dto.code) updates.code = dto.code.trim().toUpperCase();
    if (dto.name) updates.name = dto.name.trim();

    const [updated] = await this.db
      .updateTable('units')
      .set({ ...updates, updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .execute();
    return updated;
  }

  // Dosage Forms
  async findAllDosageForms() {
    return await this.db.selectFrom('dosage_forms').selectAll().orderBy('name', 'asc').execute();
  }

  async findDosageFormById(id: string) {
    return await this.db.selectFrom('dosage_forms').selectAll().where('id', '=', id).executeTakeFirst();
  }

  async findDosageFormByName(name: string) {
    return await this.db.selectFrom('dosage_forms').selectAll().where('name', '=', name).executeTakeFirst();
  }

  async createDosageForm(dto: CreateDosageFormDto) {
    const id = generateUuidV7();
    const [created] = await this.db
      .insertInto('dosage_forms')
      .values({
        id,
        name: dto.name.trim(),
      })
      .returningAll()
      .execute();
    return created;
  }

  async updateDosageForm(id: string, dto: UpdateDosageFormDto) {
    const [updated] = await this.db
      .updateTable('dosage_forms')
      .set({ name: dto.name.trim(), updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .execute();
    return updated;
  }
}
