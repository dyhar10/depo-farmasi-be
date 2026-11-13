import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Kysely } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';
import { KYSELY } from '../../../infrastructure/database/database.service';
import { DatabaseTransaction } from '../../../infrastructure/database/unit-of-work';

export interface IdempotencyRecord {
  key: string;
  userId: string;
  requestHash: string;
  responseCode?: number | null;
  responseBody?: any | null;
}

@Injectable()
export class IdempotencyService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  computeHash(payload: any): string {
    return createHash('sha256')
      .update(typeof payload === 'string' ? payload : JSON.stringify(payload ?? ''))
      .digest('hex');
  }

  async getStoredResponse(
    userId: string,
    key: string,
    requestHash: string,
    tx?: DatabaseTransaction,
  ): Promise<{ responseCode: number; responseBody: any } | null> {
    const client = tx || this.db;
    const record = await client
      .selectFrom('idempotency_keys')
      .selectAll()
      .where('user_id', '=', userId)
      .where('key', '=', key)
      .executeTakeFirst();

    if (!record) {
      return null;
    }

    if (record.request_hash !== requestHash) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
        message: 'Idempotency-Key telah dipakai dengan payload berbeda.',
      });
    }

    if (record.response_code !== null) {
      return {
        responseCode: record.response_code,
        responseBody: record.response_body,
      };
    }

    // In-flight request with same key
    throw new ConflictException({
      code: 'REQUEST_IN_PROGRESS',
      message: 'Permintaan dengan Idempotency-Key ini sedang diproses.',
    });
  }

  async lockKey(
    userId: string,
    key: string,
    requestHash: string,
    tx?: DatabaseTransaction,
  ): Promise<void> {
    const client = tx || this.db;
    await client
      .insertInto('idempotency_keys')
      .values({
        key,
        user_id: userId,
        request_hash: requestHash,
        response_code: null,
        response_body: null,
      })
      .execute();
  }

  async saveResponse(
    userId: string,
    key: string,
    responseCode: number,
    responseBody: any,
    tx?: DatabaseTransaction,
  ): Promise<void> {
    const client = tx || this.db;
    await client
      .updateTable('idempotency_keys')
      .set({
        response_code: responseCode,
        response_body: JSON.stringify(responseBody),
      })
      .where('user_id', '=', userId)
      .where('key', '=', key)
      .execute();
  }
}

