# ERD: Depo Farmasi

Diagram ini menampilkan tabel utama dan relasinya (atribut dipangkas). Definisi lengkap ada di `schema.sql`.
Semua PK = UUID v7. Tabel `stock_movements` dan `audit_logs` dipartisi bulanan.

## Master data & IAM

```mermaid
erDiagram
  users ||--o{ user_role_assignments : has
  roles ||--o{ user_role_assignments : grants
  roles ||--o{ role_permissions : has
  permissions ||--o{ role_permissions : in
  locations ||--o{ user_role_assignments : scopes
  locations ||--o{ locations : parent
  item_categories ||--o{ item_categories : parent
  item_categories ||--o{ items : classifies
  dosage_forms ||--o{ items : form
  units ||--o{ items : base_or_purchase_unit
  items ||--o| item_planning_params : has
  items ||--o{ item_suppliers : supplied_by
  suppliers ||--o{ item_suppliers : supplies
```

## Stok, batch, dan ledger

```mermaid
erDiagram
  items ||--o{ batches : "item + nomor batch"
  suppliers ||--o{ batches : from
  batches ||--o{ stock_balances : "per lokasi"
  locations ||--o{ stock_balances : holds
  batches ||--o{ stock_movements : moves
  locations ||--o{ stock_movements : at
  items ||--o{ stock_movements : of
  users ||--o{ stock_movements : actor
  items ||--o{ stock_period_summaries : summarized
  locations ||--o{ stock_period_summaries : summarized
```

## Dokumen transaksi

```mermaid
erDiagram
  receipts ||--|{ receipt_lines : has
  receipt_lines }o--|| items : of
  receipt_lines }o--o| purchase_order_lines : fulfills
  receipt_lines }o--o| batches : creates_or_uses
  suppliers ||--o{ receipts : delivers
  purchase_orders ||--o{ receipts : received_by
  requisitions ||--|{ requisition_lines : has
  requisitions ||--o{ issues : fulfilled_by
  issues ||--|{ issue_lines : has
  issue_lines }o--|| batches : picks
  stock_returns ||--|{ stock_return_lines : has
  stock_opname_sessions ||--|{ stock_opname_lines : has
  stock_opname_sessions ||--o{ stock_adjustments : produces
  stock_adjustments ||--|{ stock_adjustment_lines : has
```

## Perencanaan & pengadaan

```mermaid
erDiagram
  procurement_plans ||--|{ procurement_plan_items : has
  procurement_plan_items }o--|| items : plans
  procurement_plans ||--o{ purchase_orders : sources
  purchase_orders ||--|{ purchase_order_lines : has
  purchase_order_lines ||--o{ po_line_schedules : "jadwal W1-W5"
  purchase_order_lines }o--|| items : orders
  suppliers ||--o{ purchase_orders : penyedia
  suppliers ||--o{ purchase_orders : distributor
```

## Dukungan platform

`audit_logs` (partisi bulanan, append-only), `idempotency_keys`, `outbox_events`, `import_jobs` + `import_job_errors`, `document_counters` berdiri sendiri; hanya merujuk `users` dan entitas lewat `entity_type` + `entity_id`.
