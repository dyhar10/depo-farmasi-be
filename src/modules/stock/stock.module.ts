import { Module } from '@nestjs/common';
import { StockController } from './controllers/stock.controller';
import { PostingService } from './services/posting.service';
import { StockQueryService } from './services/stock-query.service';
import { StockRepository } from './repositories/stock.repository';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [StockController],
  providers: [PostingService, StockQueryService, StockRepository],
  exports: [PostingService, StockQueryService, StockRepository],
})
export class StockModule {}
