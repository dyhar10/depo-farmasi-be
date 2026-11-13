import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';
import { KYSELY } from '../../../infrastructure/database/database.service';
import { DatabaseTransaction } from '../../../infrastructure/database/unit-of-work';

@Injectable()
export class DocumentCounterService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  /**
   * Generates a concurrency-safe unique document number in the format:
   * [DOC_TYPE]-[YYYY-MM]-[000001] (e.g. RCV-2026-11-000001)
   */
  async getNextDocumentNumber(
    docType: string,
    date: Date = new Date(),
    tx?: DatabaseTransaction,
  ): Promise<string> {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const period = `${year}-${month}`;

    const client = tx || this.db;

    const result = await sql<{ last_number: string }>`
      INSERT INTO document_counters (doc_type, period, last_number)
      VALUES (${docType}, ${period}, 1)
      ON CONFLICT (doc_type, period)
      DO UPDATE SET last_number = document_counters.last_number + 1
      RETURNING last_number;
    `.execute(client);

    const nextNumber = result.rows[0]?.last_number ?? 1;
    const formattedSequence = String(nextNumber).padStart(6, '0');
    return `${docType}-${period}-${formattedSequence}`;
  }
}

