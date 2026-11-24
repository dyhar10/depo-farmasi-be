import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { AuditModule } from './modules/audit/audit.module';
import { PlatformModule } from './modules/platform/platform.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MasterModule } from './modules/master/master.module';
import { StockModule } from './modules/stock/stock.module';
import { ImportsModule } from './modules/imports/imports.module';
import type { Request, Response, NextFunction } from 'express';
import { generateUuidV7 } from './common/utils/uuid';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    AuditModule,
    PlatformModule,
    AuthModule,
    UsersModule,
    MasterModule,
    StockModule,
    ImportsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: Request, res: Response, next: NextFunction) => {
        const requestId = (req.headers['x-request-id'] as string) || generateUuidV7();
        req.headers['x-request-id'] = requestId;
        res.setHeader('X-Request-Id', requestId);
        next();
      })
      .forRoutes('*');
  }
}

