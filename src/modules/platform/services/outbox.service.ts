import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';
import { KYSELY } from '../../../infrastructure/database/database.service';
import { DatabaseTransaction } from '../../../infrastructure/database/unit-of-work';
import { generateUuidV7 } from '../../../common/utils/uuid';

export interface OutboxMessage {
  id?: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, any>;
}

@Injectable()
export class OutboxService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async publish(message: OutboxMessage, tx?: DatabaseTransaction): Promise<void> {
    const executor = tx || this.db;
    await executor.insertInto('outbox_events').values({
      id: message.id || generateUuidV7(),
      aggregate_type: message.aggregateType,
      aggregate_id: message.aggregateId,
      event_type: message.eventType,
      payload: JSON.stringify(message.payload),
      created_at: new Date(),
    }).execute();
  }
}
