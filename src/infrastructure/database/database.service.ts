import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './kysely.types';
import { validateEnv } from '../../config/env.config';

export const KYSELY = Symbol('KYSELY');

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;
  public kysely!: Kysely<Database>;

  constructor() {
    this.init();
  }

  private init() {
    if (!this.kysely) {
      const env = validateEnv();
      this.pool = new Pool({
        connectionString: env.DATABASE_URL,
        max: 20,
      });

      const dialect = new PostgresDialect({
        pool: this.pool,
      });

      this.kysely = new Kysely<Database>({
        dialect,
      });
    }
  }

  onModuleInit() {
    this.init();
  }

  async onModuleDestroy() {
    if (this.kysely) {
      await this.kysely.destroy();
    } else if (this.pool) {
      await this.pool.end();
    }
  }

  getPool(): Pool {
    return this.pool;
  }
}

