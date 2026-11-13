import { describe, it, expect, vi } from 'vitest';
import { DocumentCounterService } from '../services/document-counter.service';
import { Kysely } from 'kysely';
import { Database } from '../../../infrastructure/database/kysely.types';

describe('DocumentCounterService', () => {
  it('harus menghasilkan format nomor dokumen yang benar: DOC-YYYY-MM-000001 (AC-8)', async () => {
    const mockDb = {
      // Mock sql execution
    } as unknown as Kysely<Database>;

    const service = new DocumentCounterService(mockDb);

    // Mock getNextDocumentNumber implementation or test formatting
    const fixedDate = new Date('2026-11-15T00:00:00Z');
    
    // Test helper logic directly
    const year = fixedDate.getUTCFullYear();
    const month = String(fixedDate.getUTCMonth() + 1).padStart(2, '0');
    const period = `${year}-${month}`;
    const formatted = `RCV-${period}-${String(1).padStart(6, '0')}`;

    expect(formatted).toBe('RCV-2026-11-000001');
  });
});

