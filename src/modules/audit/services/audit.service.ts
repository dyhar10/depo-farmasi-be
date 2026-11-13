import { Injectable } from '@nestjs/common';
import { AuditRepository } from '../repositories/audit.repository';
import { AuditLogEntry } from '../domain/audit.entity';
import { DatabaseTransaction } from '../../../infrastructure/database/unit-of-work';

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async log(entry: AuditLogEntry, tx?: DatabaseTransaction): Promise<void> {
    await this.auditRepository.create(entry, tx);
  }
}

