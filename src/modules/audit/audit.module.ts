import { Global, Module } from '@nestjs/common';
import { AuditRepository } from './repositories/audit.repository';
import { AuditService } from './services/audit.service';

@Global()
@Module({
  providers: [AuditRepository, AuditService],
  exports: [AuditService],
})
export class AuditModule {}

