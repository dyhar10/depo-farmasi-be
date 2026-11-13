import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';
import { KYSELY } from '../../../infrastructure/database/database.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  database: boolean;
  redis: boolean;
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly redisService: RedisService,
  ) {}

  async checkLive(): Promise<{ status: 'ok'; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async checkReady(): Promise<HealthStatus> {
    let dbOk = false;
    let redisOk = false;

    try {
      const res = await sql`SELECT 1 as alive`.execute(this.db);
      dbOk = Array.isArray(res.rows) && res.rows.length > 0;
    } catch {
      dbOk = false;
    }

    try {
      redisOk = await this.redisService.ping();
    } catch {
      redisOk = false;
    }

    const isHealthy = dbOk && redisOk;
    return {
      status: isHealthy ? 'ok' : dbOk ? 'degraded' : 'error',
      timestamp: new Date().toISOString(),
      database: dbOk,
      redis: redisOk,
    };
  }
}

