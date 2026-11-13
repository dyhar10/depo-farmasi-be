import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';
import { KYSELY } from '../../../infrastructure/database/database.service';
import { generateUuidV7 } from '../../../common/utils/uuid';
import { DatabaseTransaction } from '../../../infrastructure/database/unit-of-work';

@Injectable()
export class UserRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async findAll() {
    return await this.db
      .selectFrom('users')
      .select([
        'id',
        'username',
        'email',
        'full_name',
        'is_active',
        'must_change_password',
        'failed_login_count',
        'locked_until',
        'last_login_at',
        'created_at',
        'updated_at',
      ])
      .where('deleted_at', 'is', null)
      .orderBy('username', 'asc')
      .execute();
  }

  async findById(id: string) {
    return await this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async findByUsername(username: string) {
    return await this.db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async create(user: {
    username: string;
    email?: string | null;
    full_name: string;
    password_hash: string;
    must_change_password?: boolean;
  }) {
    const id = generateUuidV7();
    const [created] = await this.db
      .insertInto('users')
      .values({
        id,
        username: user.username,
        email: user.email || null,
        full_name: user.full_name,
        password_hash: user.password_hash,
        must_change_password: user.must_change_password ?? true,
      })
      .returning([
        'id',
        'username',
        'email',
        'full_name',
        'is_active',
        'must_change_password',
        'created_at',
        'updated_at',
      ])
      .execute();

    return created;
  }

  async update(id: string, updates: Partial<{
    full_name: string;
    email: string | null;
    is_active: boolean;
    password_hash: string;
  }>) {
    const [updated] = await this.db
      .updateTable('users')
      .set({
        ...updates,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returning([
        'id',
        'username',
        'email',
        'full_name',
        'is_active',
        'must_change_password',
        'updated_at',
      ])
      .execute();

    return updated;
  }

  async softDelete(id: string) {
    await this.db
      .updateTable('users')
      .set({
        is_active: false,
        deleted_at: new Date(),
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .execute();
  }

  async findAllRoles() {
    return await this.db
      .selectFrom('roles')
      .selectAll()
      .orderBy('name', 'asc')
      .execute();
  }

  async countAdminUsers(): Promise<number> {
    const res = await this.db
      .selectFrom('user_role_assignments as ura')
      .innerJoin('roles as r', 'r.id', 'ura.role_id')
      .innerJoin('users as u', 'u.id', 'ura.user_id')
      .select((eb) => eb.fn.count<string>('u.id').as('count'))
      .where('r.code', '=', 'admin')
      .where('u.is_active', '=', true)
      .where('u.deleted_at', 'is', null)
      .executeTakeFirst();

    return parseInt(res?.count || '0', 10);
  }

  async getUserRoleAssignments(userId: string) {
    return await this.db
      .selectFrom('user_role_assignments as ura')
      .innerJoin('roles as r', 'r.id', 'ura.role_id')
      .leftJoin('locations as l', 'l.id', 'ura.location_id')
      .select([
        'ura.id as assignment_id',
        'r.id as role_id',
        'r.code as role_code',
        'r.name as role_name',
        'ura.location_id',
        'l.name as location_name',
      ])
      .where('ura.user_id', '=', userId)
      .execute();
  }

  async replaceUserRoles(
    userId: string,
    assignments: Array<{ role_id: string; location_id?: string | null }>,
    tx?: DatabaseTransaction,
  ) {
    const client = tx || this.db;

    await client
      .deleteFrom('user_role_assignments')
      .where('user_id', '=', userId)
      .execute();

    if (assignments.length > 0) {
      await client
        .insertInto('user_role_assignments')
        .values(
          assignments.map((a) => ({
            id: generateUuidV7(),
            user_id: userId,
            role_id: a.role_id,
            location_id: a.location_id || null,
          })),
        )
        .execute();
    }
  }
}

