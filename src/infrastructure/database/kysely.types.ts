import { ColumnType, Generated } from 'kysely';

export interface UsersTable {
  id: Generated<string>;
  username: string;
  email: string | null;
  full_name: string;
  password_hash: string;
  is_active: Generated<boolean>;
  must_change_password: Generated<boolean>;
  failed_login_count: Generated<number>;
  locked_until: ColumnType<Date | null, string | Date | null, string | Date | null>;
  last_login_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
}

export interface RolesTable {
  id: Generated<string>;
  code: string;
  name: string;
  description: string | null;
  is_system: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface PermissionsTable {
  code: string;
  description: string | null;
}

export interface RolePermissionsTable {
  role_id: string;
  permission_code: string;
}

export interface LocationsTable {
  id: Generated<string>;
  code: string;
  name: string;
  location_type:
    | 'gudang'
    | 'depo'
    | 'ruangan'
    | 'inventaris'
    | 'troli_emergensi'
    | 'laboratorium'
    | 'radiologi'
    | 'lainnya';
  parent_id: string | null;
  holds_stock: Generated<boolean>;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
}

export interface UserRoleAssignmentsTable {
  id: Generated<string>;
  user_id: string;
  role_id: string;
  location_id: string | null;
  created_at: Generated<Date>;
}

export interface RefreshTokensTable {
  id: Generated<string>;
  user_id: string;
  family_id: string;
  token_hash: string;
  expires_at: ColumnType<Date, string | Date, string | Date>;
  revoked_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
  replaced_by: string | null;
  user_agent: string | null;
  ip: string | null;
  created_at: Generated<Date>;
}

export interface AuditLogsTable {
  id: Generated<string>;
  occurred_at: Generated<Date>;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: any | null;
  new_values: any | null;
  request_id: string | null;
  ip: string | null;
}

export interface IdempotencyKeysTable {
  key: string;
  user_id: string;
  request_hash: string;
  response_code: number | null;
  response_body: any | null;
  created_at: Generated<Date>;
  expires_at: Generated<Date>;
}

export interface OutboxEventsTable {
  id: Generated<string>;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Generated<any>;
  created_at: Generated<Date>;
  processed_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
}

export interface DocumentCountersTable {
  doc_type: string;
  period: string;
  last_number: Generated<string | number | bigint>;
}

// ============================================================================
// Phase 1: Master Data & Stock Types
// ============================================================================

export interface UnitsTable {
  id: Generated<string>;
  code: string;
  name: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface DosageFormsTable {
  id: Generated<string>;
  name: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ItemCategoriesTable {
  id: Generated<string>;
  parent_id: string | null;
  item_type: 'obat' | 'bmhp';
  code: string;
  name: string;
  level: number;
  sort_order: Generated<number>;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface SuppliersTable {
  id: Generated<string>;
  code: string | null;
  name: string;
  supplier_type: 'penyedia' | 'distributor' | 'donor' | 'lainnya';
  contact: Generated<any>;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
}

export interface ItemsTable {
  id: Generated<string>;
  code: string;
  item_type: 'obat' | 'bmhp';
  category_id: string;
  generic_name: string;
  brand_name: string | null;
  dosage_form_id: string | null;
  strength: string | null;
  atc_code: string | null;
  ddd: string | number | null;
  base_unit_id: string;
  purchase_unit_id: string | null;
  pack_size: Generated<string | number>;
  catalog_type: Generated<'ekatalog' | 'non_ekatalog'>;
  formulary_status: 'formularium' | 'non_formularium' | null;
  fornas_class: 'fornas_generik' | 'fornas_non_generik' | 'non_fornas_non_generik' | null;
  reference_price: string | number | null;
  is_active: Generated<boolean>;
  legacy_ref: any | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
}

export interface ItemPlanningParamsTable {
  item_id: string;
  safety_stock: Generated<string | number>;
  min_stock: Generated<string | number>;
  moving_class: 'fast_1' | 'fast_2' | 'slow' | 'non_moving' | null;
  moving_class_is_manual: Generated<boolean>;
  moving_class_updated_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
  purchase_note: string | null;
  updated_by: string | null;
  updated_at: Generated<Date>;
}

export interface ItemSuppliersTable {
  id: Generated<string>;
  item_id: string;
  supplier_id: string;
  relation: 'penyedia' | 'distributor';
  is_default: Generated<boolean>;
  created_at: Generated<Date>;
}

export interface BatchesTable {
  id: Generated<string>;
  item_id: string;
  batch_number: string;
  expiry_date: ColumnType<Date | null, string | Date | null, string | Date | null>;
  no_expiry: Generated<boolean>;
  unit_cost: string | number;
  supplier_id: string | null;
  source_type: Generated<'pembelian' | 'hibah' | 'program' | 'pinjaman' | 'btt' | 'legacy'>;
  is_legacy: Generated<boolean>;
  legacy_price_seq: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface StockBalancesTable {
  location_id: string;
  batch_id: string;
  item_id: string;
  quantity: Generated<string | number>;
  row_version: Generated<string | number | bigint>;
  updated_at: Generated<Date>;
}

export interface StockMovementsTable {
  id: Generated<string>;
  occurred_at: ColumnType<Date, string | Date, string | Date>;
  posted_at: Generated<Date>;
  item_id: string;
  batch_id: string;
  location_id: string;
  counter_location_id: string | null;
  movement_type: string;
  quantity: string | number;
  unit_cost: string | number;
  document_type: string;
  document_id: string;
  document_line_id: string | null;
  reversal_of_id: string | null;
  actor_id: string;
}

export interface ImportJobsTable {
  id: Generated<string>;
  import_type: 'items' | 'opening_balance' | 'receipts_history' | 'suppliers' | 'locations';
  filename: string;
  file_sha256: string;
  status: Generated<'uploaded' | 'validating' | 'validated' | 'importing' | 'completed' | 'failed'>;
  dry_run: Generated<boolean>;
  summary: Generated<any>;
  created_by: string | null;
  created_at: Generated<Date>;
  finished_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
}

export interface ImportJobErrorsTable {
  id: Generated<string>;
  job_id: string;
  sheet: string | null;
  row_number: number | null;
  field: string | null;
  message: string;
}

export interface Database {
  users: UsersTable;
  roles: RolesTable;
  permissions: PermissionsTable;
  role_permissions: RolePermissionsTable;
  locations: LocationsTable;
  user_role_assignments: UserRoleAssignmentsTable;
  refresh_tokens: RefreshTokensTable;
  audit_logs: AuditLogsTable;
  idempotency_keys: IdempotencyKeysTable;
  outbox_events: OutboxEventsTable;
  document_counters: DocumentCountersTable;
  // Master data
  units: UnitsTable;
  dosage_forms: DosageFormsTable;
  item_categories: ItemCategoriesTable;
  suppliers: SuppliersTable;
  items: ItemsTable;
  item_planning_params: ItemPlanningParamsTable;
  item_suppliers: ItemSuppliersTable;
  // Stock
  batches: BatchesTable;
  stock_balances: StockBalancesTable;
  stock_movements: StockMovementsTable;
  // Imports
  import_jobs: ImportJobsTable;
  import_job_errors: ImportJobErrorsTable;
}
