import { Global, Module } from '@nestjs/common';
import { DatabaseService, KYSELY } from './database.service';
import { UnitOfWork } from './unit-of-work';

@Global()
@Module({
  providers: [
    DatabaseService,
    {
      provide: KYSELY,
      useFactory: (dbService: DatabaseService) => dbService.kysely,
      inject: [DatabaseService],
    },
    UnitOfWork,
  ],
  exports: [DatabaseService, KYSELY, UnitOfWork],
})
export class DatabaseModule {}

