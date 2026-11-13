import { Inject, Injectable } from '@nestjs/common';
import { Kysely, Transaction } from 'kysely';
import { Database } from './kysely.types';
import { KYSELY } from './database.service';

export type DatabaseTransaction = Transaction<Database>;

@Injectable()
export class UnitOfWork {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async run<T>(operation: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
    return await this.db.transaction().execute(async (tx) => {
      return await operation(tx);
    });
  }
}

