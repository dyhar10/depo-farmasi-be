import { Module } from '@nestjs/common';
import { MasterController } from './controllers/master.controller';
import { MasterService } from './services/master.service';
import { ItemRepository } from './repositories/item.repository';
import { CategoryRepository } from './repositories/category.repository';
import { ReferenceRepository } from './repositories/reference.repository';
import { SupplierRepository } from './repositories/supplier.repository';
import { LocationRepository } from './repositories/location.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MasterController],
  providers: [
    MasterService,
    ItemRepository,
    CategoryRepository,
    ReferenceRepository,
    SupplierRepository,
    LocationRepository,
  ],
  exports: [
    MasterService,
    ItemRepository,
    CategoryRepository,
    ReferenceRepository,
    SupplierRepository,
    LocationRepository,
  ],
})
export class MasterModule {}
