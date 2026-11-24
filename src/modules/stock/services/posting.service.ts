import { BadRequestException, Injectable } from '@nestjs/common';
import { UnitOfWork, DatabaseTransaction } from '../../../infrastructure/database/unit-of-work';
import { StockRepository } from '../repositories/stock.repository';
import { OutboxService } from '../../platform/services/outbox.service';
import { AuditService } from '../../audit/services/audit.service';
import { StockDomainRules, InsufficientStockError } from '../domain/stock.rules';
import { PostingInput, StockMovementEntity } from '../domain/stock.entity';
import { generateUuidV7 } from '../../../common/utils/uuid';
import { Decimal } from 'decimal.js';

@Injectable()
export class PostingService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly stockRepository: StockRepository,
    private readonly outboxService: OutboxService,
    private readonly auditService: AuditService,
  ) {}

  async post(
    input: PostingInput,
    externalTx?: DatabaseTransaction,
  ): Promise<{ movementIds: string[] }> {
    if (!input.lines || input.lines.length === 0) {
      throw new BadRequestException('Posting stok membutuhkan minimal satu baris mutasi');
    }

    const executeOperation = async (tx: DatabaseTransaction) => {
      // 0. Validasi lokasi dapat menyimpan stok (holds_stock = true dan aktif)
      const uniqueLocationIds = Array.from(new Set(input.lines.map((l) => l.locationId)));
      try {
        await this.stockRepository.validateLocationsHoldStock(uniqueLocationIds, tx);
      } catch (err: any) {
        throw new BadRequestException(err.message);
      }

      // Validasi item aktif (kecuali mutasi reversal)
      const nonReversalItemIds = Array.from(
        new Set(
          input.lines
            .filter((l) => l.movementType !== 'reversal')
            .map((l) => l.itemId),
        ),
      );
      if (nonReversalItemIds.length > 0) {
        try {
          await this.stockRepository.validateItemsActive(nonReversalItemIds, tx);
        } catch (err: any) {
          throw new BadRequestException(err.message);
        }
      }

      // 1. Resolve batchId untuk setiap baris
      const resolvedLines: Array<{
        itemId: string;
        locationId: string;
        batchId: string;
        counterLocationId?: string;
        movementType: PostingInput['lines'][0]['movementType'];
        quantity: Decimal;
        unitCost: string;
        documentLineId?: string;
        reversalOfId?: string;
      }> = [];

      for (const line of input.lines) {
        let batchId = line.batchId;
        let unitCost = line.unitCost;

        if (!batchId) {
          if (!line.batchNumber) {
            throw new BadRequestException(
              `Baris mutasi untuk item ${line.itemId} harus memiliki batchId atau batchNumber`,
            );
          }

          const batch = await this.stockRepository.findOrCreateBatch(
            {
              itemId: line.itemId,
              batchNumber: line.batchNumber,
              expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
              noExpiry: line.noExpiry,
              unitCost: line.unitCost,
              supplierId: line.supplierId,
              sourceType: line.sourceType,
              isLegacy: line.isLegacy,
              legacyPriceSeq: line.legacyPriceSeq,
            },
            tx,
          );
          batchId = batch.id;
          unitCost = batch.unitCost;
        }

        const signedQuantity = StockDomainRules.toSignedQuantity(line.movementType, line.quantity);

        resolvedLines.push({
          itemId: line.itemId,
          locationId: line.locationId,
          batchId,
          counterLocationId: line.counterLocationId,
          movementType: line.movementType,
          quantity: signedQuantity,
          unitCost,
          documentLineId: line.documentLineId,
          reversalOfId: line.reversalOfId,
        });
      }

      // 2. Kumpulkan pasangan unik (locationId, batchId) untuk penguncian berurutan
      const pairMap = new Map<string, { locationId: string; batchId: string; itemId: string }>();
      for (const line of resolvedLines) {
        const key = `${line.locationId}:${line.batchId}`;
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            locationId: line.locationId,
            batchId: line.batchId,
            itemId: line.itemId,
          });
        }
      }

      // 3. Kunci baris saldo berurutan (mencegah deadlock)
      const lockedBalances = await this.stockRepository.lockBalances(
        Array.from(pairMap.values()),
        tx,
      );

      // Inisialisasi peta saldo saat ini di memori
      const currentBalances = new Map<string, Decimal>();
      for (const lb of lockedBalances) {
        currentBalances.set(`${lb.locationId}:${lb.batchId}`, new Decimal(lb.quantity));
      }

      // 4. Proses setiap baris mutasi dan perbarui saldo
      const movements: StockMovementEntity[] = [];
      const movementIds: string[] = [];
      const occurredAt = input.occurredAt || new Date();
      const postedAt = new Date();

      for (const line of resolvedLines) {
        const key = `${line.locationId}:${line.batchId}`;
        const currentQty = currentBalances.get(key) || new Decimal(0);

        try {
          const nextQty = StockDomainRules.calculateNewBalance(currentQty, line.quantity, {
            itemId: line.itemId,
            locationId: line.locationId,
          });
          currentBalances.set(key, nextQty);
        } catch (err: any) {
          if (err instanceof InsufficientStockError) {
            throw new BadRequestException(err.message);
          }
          throw err;
        }

        const movementId = generateUuidV7();
        movementIds.push(movementId);

        movements.push({
          id: movementId,
          occurredAt,
          postedAt,
          itemId: line.itemId,
          batchId: line.batchId,
          locationId: line.locationId,
          counterLocationId: line.counterLocationId || null,
          movementType: line.movementType,
          quantity: line.quantity.toString(),
          unitCost: line.unitCost,
          documentType: input.documentType,
          documentId: input.documentId,
          documentLineId: line.documentLineId || null,
          reversalOfId: line.reversalOfId || null,
          actorId: input.actorId,
        });
      }

      // 5. Simpan mutasi ledger
      await this.stockRepository.insertMovements(movements, tx);

      // 6. Perbarui baris saldo stok di database
      for (const [key, finalQty] of currentBalances.entries()) {
        const [locationId, batchId] = key.split(':');
        await this.stockRepository.updateBalance(locationId, batchId, finalQty.toString(), tx);
      }

      // 7. Catat outbox event
      await this.outboxService.publish(
        {
          aggregateType: 'stock',
          aggregateId: input.documentId,
          eventType: 'stock.movement.posted',
          payload: {
            documentType: input.documentType,
            documentId: input.documentId,
            linesCount: input.lines.length,
            occurredAt: occurredAt.toISOString(),
          },
        },
        tx,
      );

      // 8. Catat audit log
      await this.auditService.log(
        {
          actor_id: input.actorId,
          action: 'stock.post',
          entity_type: input.documentType,
          entity_id: input.documentId,
          new_values: {
            linesCount: input.lines.length,
            documentType: input.documentType,
            occurredAt: occurredAt.toISOString(),
          },
        },
        tx,
      );

      return { movementIds };
    };

    if (externalTx) {
      return await executeOperation(externalTx);
    }
    return await this.unitOfWork.run(executeOperation);
  }
}
