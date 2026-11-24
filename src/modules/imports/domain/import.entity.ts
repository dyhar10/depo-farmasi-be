export type ImportType =
  | 'items'
  | 'opening_balance'
  | 'receipts_history'
  | 'suppliers'
  | 'locations';

export type ImportJobStatus =
  | 'uploaded'
  | 'validating'
  | 'validated'
  | 'importing'
  | 'completed'
  | 'failed';

export interface ImportJobSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  createdCount?: number;
  skippedCount?: number;
  reconciliation?: {
    totalSheetStock: string;
    totalCalculatedStock: string;
    totalDifference: string;
    mismatches: Array<{
      itemCode: string;
      sheetTotal: string;
      calculatedTotal: string;
      difference: string;
    }>;
  };
  notes?: string[];
}

export interface ImportJobEntity {
  id: string;
  importType: ImportType;
  filename: string;
  fileSha256: string;
  status: ImportJobStatus;
  dryRun: boolean;
  summary: ImportJobSummary;
  createdBy: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}

export interface ImportJobErrorEntity {
  id: string;
  jobId: string;
  sheet: string | null;
  rowNumber: number | null;
  field: string | null;
  message: string;
}

export interface ParsedItemRow {
  rowNumber: number;
  code: string;
  itemType: 'obat' | 'bmhp';
  categoryCodeOrName: string;
  genericName: string;
  brandName?: string | null;
  dosageFormName?: string | null;
  strength?: string | null;
  atcCode?: string | null;
  ddd?: string | null;
  baseUnitCode: string;
  purchaseUnitCode?: string | null;
  packSize: string;
  catalogType: 'ekatalog' | 'non_ekatalog';
  formularyStatus?: 'formularium' | 'non_formularium' | null;
  fornasClass?: 'fornas_generik' | 'fornas_non_generik' | 'non_fornas_non_generik' | null;
  referencePrice?: string | null;
  safetyStock?: string;
  minStock?: string;
  purchaseNotes?: string | null;
}

export interface ParsedOpeningBalanceRow {
  rowNumber: number;
  itemCode: string;
  legacyPriceSeq: number;
  unitCost: string;
  sheetTotalStock?: string;
  locationQuantities: Array<{
    locationCode: string;
    quantity: string;
  }>;
}

export interface ParsedSupplierRow {
  rowNumber: number;
  code: string;
  name: string;
  supplierType: 'penyedia' | 'distributor' | 'donor' | 'lainnya';
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface ParsedLocationRow {
  rowNumber: number;
  code: string;
  name: string;
  locationType:
    | 'gudang'
    | 'depo'
    | 'ruangan'
    | 'inventaris'
    | 'troli_emergensi'
    | 'laboratorium'
    | 'radiologi'
    | 'lainnya';
  holdsStock: boolean;
  parentCode?: string | null;
}
