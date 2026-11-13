import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';
import { KYSELY } from '../../../infrastructure/database/database.service';
import { AuditLogEntry } from '../domain/audit.entity';
import { generateUuidV7 } from '../../../common/utils/uuid';
import { DatabaseTransaction } from '../../../infrastructure/database/unit-of-work';

@Injectable()
export class AuditRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async create(entry: AuditLogEntry, tx?: DatabaseTransaction): Promise<void> {
    const client = tx || this.db;
    await client.insertInto('audit_logs').values({
      id: entry.id || generateUuidV7(),
      occurred_at: entry.occurred_at || new Date(),
      actor_id: entry.actor_id ?? null,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      old_values: entry.old_values ? JSON.stringify(entry.old_values) : null,
      new_values: entry.new_values ? JSON.stringify(entry.new_values) : null,
      request_id: entry.request_id ?? null,
      ip: entry.ip ?? null,
    }).execute();
  }
}

