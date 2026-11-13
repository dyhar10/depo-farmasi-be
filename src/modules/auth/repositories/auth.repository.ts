import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';
import { KYSELY } from '../../../infrastructure/database/database.service';
import { generateUuidV7 } from '../../../common/utils/uuid';

@Injectable()
export class AuthRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async findUserByUsername(username: string) {
    return await this.db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async findUserById(id: string) {
    return await this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async recordFailedLogin(userId: string, currentCount: number) {
    const newCount = currentCount + 1;
    let lockedUntil: Date | null = null;

    if (newCount >= 5) {
      // Lock for 15 minutes
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }

    await this.db
      .updateTable('users')
      .set({
        failed_login_count: newCount,
        locked_until: lockedUntil,
        updated_at: new Date(),
      })
      .where('id', '=', userId)
      .execute();

    return { newCount, lockedUntil };
  }

  async resetFailedLogin(userId: string) {
    await this.db
      .updateTable('users')
      .set({
        failed_login_count: 0,
        locked_until: null,
        last_login_at: new Date(),
        updated_at: new Date(),
      })
      .where('id', '=', userId)
      .execute();
  }

  async updatePassword(userId: string, newHash: string) {
    await this.db
      .updateTable('users')
      .set({
        password_hash: newHash,
        must_change_password: false,
        updated_at: new Date(),
      })
      .where('id', '=', userId)
      .execute();
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom('user_role_assignments as ura')
      .innerJoin('role_permissions as rp', 'rp.role_id', 'ura.role_id')
      .select('rp.permission_code')
      .distinct()
      .where('ura.user_id', '=', userId)
      .execute();

    return rows.map((r) => r.permission_code);
  }

  async getUserRoleAssignments(userId: string) {
    return await this.db
      .selectFrom('user_role_assignments as ura')
      .innerJoin('roles as r', 'r.id', 'ura.role_id')
      .select([
        'r.id as role_id',
        'r.code as role_code',
        'r.name as role_name',
        'ura.location_id',
      ])
      .where('ura.user_id', '=', userId)
      .execute();
  }

  async createRefreshToken(data: {
    userId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ip?: string;
  }) {
    const id = generateUuidV7();
    await this.db
      .insertInto('refresh_tokens')
      .values({
        id,
        user_id: data.userId,
        family_id: data.familyId,
        token_hash: data.tokenHash,
        expires_at: data.expiresAt,
        user_agent: data.userAgent || null,
        ip: data.ip || null,
      })
      .execute();
    return id;
  }

  async findRefreshToken(tokenHash: string) {
    return await this.db
      .selectFrom('refresh_tokens')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst();
  }

  async revokeTokenFamily(familyId: string) {
    await this.db
      .updateTable('refresh_tokens')
      .set({
        revoked_at: new Date(),
      })
      .where('family_id', '=', familyId)
      .where('revoked_at', 'is', null)
      .execute();
  }

  async rotateRefreshToken(
    oldTokenId: string,
    newToken: {
      userId: string;
      familyId: string;
      tokenHash: string;
      expiresAt: Date;
      userAgent?: string;
      ip?: string;
    },
  ) {
    const newId = generateUuidV7();
    await this.db.transaction().execute(async (tx) => {
      await tx
        .updateTable('refresh_tokens')
        .set({
          revoked_at: new Date(),
          replaced_by: newId,
        })
        .where('id', '=', oldTokenId)
        .execute();

      await tx
        .insertInto('refresh_tokens')
        .values({
          id: newId,
          user_id: newToken.userId,
          family_id: newToken.familyId,
          token_hash: newToken.tokenHash,
          expires_at: newToken.expiresAt,
          user_agent: newToken.userAgent || null,
          ip: newToken.ip || null,
        })
        .execute();
    });

    return newId;
  }
}

