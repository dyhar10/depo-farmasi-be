import { Global, Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { HealthService } from './services/health.service';
import { DocumentCounterService } from './services/document-counter.service';
import { IdempotencyService } from './services/idempotency.service';

@Global()
@Module({
  controllers: [HealthController],
  providers: [HealthService, DocumentCounterService, IdempotencyService],
  exports: [HealthService, DocumentCounterService, IdempotencyService],
})
export class PlatformModule {}

