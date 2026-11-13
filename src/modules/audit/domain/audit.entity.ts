export interface AuditLogEntry {
  id?: string;
  occurred_at?: Date;
  actor_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  request_id?: string | null;
  ip?: string | null;
}

