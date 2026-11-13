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
  location_type: 'gudang' | 'depo' | 'ruangan' | 'inventaris' | 'troli_emergensi' | 'laboratorium' | 'radiologi' | 'lainnya';
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
}

