import { Module } from '@nestjs/common';
import { ImportController } from './controllers/import.controller';
import { ImportService } from './services/import.service';
import { ImportRepository } from './repositories/import.repository';
import { StockModule } from '../stock/stock.module';
import { AuditModule } from '../audit/audit.module';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [StockModule, AuditModule, PlatformModule],
  controllers: [ImportController],
  providers: [ImportService, ImportRepository],
  exports: [ImportService, ImportRepository],
})
export class ImportsModule {}
