import { MovementType } from './stock.rules';

export interface BatchEntity {
  id: string;
  itemId: string;
  batchNumber: string;
  expiryDate: Date | null;
  noExpiry: boolean;
  unitCost: string;
  supplierId: string | null;
  sourceType: 'pembelian' | 'hibah' | 'program' | 'pinjaman' | 'btt' | 'legacy';
  isLegacy: boolean;
  legacyPriceSeq: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockBalanceEntity {
  locationId: string;
  batchId: string;
  itemId: string;
  quantity: string;
  rowVersion: string | number | bigint;
  updatedAt: Date;
}

export interface StockMovementEntity {
  id: string;
  occurredAt: Date;
  postedAt: Date;
  itemId: string;
  batchId: string;
  locationId: string;
  counterLocationId: string | null;
  movementType: MovementType;
  quantity: string;
  unitCost: string;
  documentType: string;
  documentId: string;
  documentLineId: string | null;
  reversalOfId: string | null;
  actorId: string;
}

export interface PostingLine {
  itemId: string;
  locationId: string;
  batchId?: string;
  batchNumber?: string;
  expiryDate?: Date | string | null;
  noExpiry?: boolean;
  unitCost: string;
  supplierId?: string | null;
  sourceType?: 'pembelian' | 'hibah' | 'program' | 'pinjaman' | 'btt' | 'legacy';
  isLegacy?: boolean;
  legacyPriceSeq?: number | null;
  counterLocationId?: string;
  movementType: MovementType;
  quantity: string;
  documentLineId?: string;
  reversalOfId?: string;
}

export interface PostingInput {
  documentType: string;
  documentId: string;
  documentNumber?: string;
  occurredAt?: Date;
  actorId: string;
  lines: PostingLine[];
}
