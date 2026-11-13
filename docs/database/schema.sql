-- =====================================================================
-- Depo Farmasi: PostgreSQL 16+ schema
-- Aturan inti (lihat .agents/rules/10-database.md):
--   * Semua primary key = UUID v7 (waktu-terurut, tidak bisa ditebak, tanpa sequence/auto-increment).
--   * Uang NUMERIC(18,4), qty NUMERIC(18,3). Tidak ada float.
--   * Enum = TEXT + CHECK (mudah diubah lewat migrasi), bukan tipe ENUM native.
--   * Ledger (stock_movements) dan audit_logs: append-only, dipartisi bulanan.
--   * Stok TIDAK pernah diedit langsung: stock_balances hanya berubah lewat posting mutasi.
-- Nomor dokumen yang terbaca manusia (receipt_number, dst.) BUKAN primary key dan tidak
-- dipakai untuk otorisasi; dibuat dari document_counters.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------
-- 0. Fungsi bantu
-- ---------------------------------------------------------------------

-- UUID v7 (48 bit timestamp ms + acak). Di PostgreSQL 18+ ganti dengan uuidv7() bawaan.
CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid
LANGUAGE plpgsql VOLATILE AS $$
BEGIN
  RETURN encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid())
                PLACING substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
                FROM 1 FOR 6),
        52, 1),
      53, 1),
    'hex')::uuid;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% bersifat append-only: UPDATE/DELETE tidak diizinkan', TG_TABLE_NAME;
END $$;

-- ---------------------------------------------------------------------
-- 1. IAM: pengguna, peran, hak akses
-- ---------------------------------------------------------------------

CREATE TABLE users (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  username             citext NOT NULL UNIQUE,
  email                citext UNIQUE,
  full_name            text NOT NULL,
  password_hash        text NOT NULL,                  -- argon2id
  is_active            boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  failed_login_count   integer NOT NULL DEFAULT 0,
  locked_until         timestamptz,
  last_login_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code        text NOT NULL UNIQUE,                    -- admin, kepala_depo, perencana, staf_gudang, staf_depo, peminta_ruangan, auditor
  name        text NOT NULL,
  description text,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  code        text PRIMARY KEY,                        -- mis. stock.receipt.post (kunci alami, bukan sequence)
  description text
);

CREATE TABLE role_permissions (
  role_id         uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

-- ---------------------------------------------------------------------
-- 2. Master data
-- ---------------------------------------------------------------------

CREATE TABLE units (                                   -- satuan: Tablet, Kapsul, Ampul, Box, Botol, Pcs, Tube, ...
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dosage_forms (                            -- bentuk sediaan
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  name       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pohon kategori: akar = Obat / BMHP; anak = sub kategori (Obat Generik, High Alert, BMHP Umum, ...);
-- cucu = sub-sub kategori. level 1..3.
CREATE TABLE item_categories (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  parent_id  uuid REFERENCES item_categories(id),
  item_type  text NOT NULL CHECK (item_type IN ('obat','bmhp')),
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  level      smallint NOT NULL CHECK (level BETWEEN 1 AND 3),
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_item_categories_parent ON item_categories(parent_id);

CREATE TABLE suppliers (                               -- penyedia (pabrik), distributor, donor hibah/program
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code          text UNIQUE,
  name          text NOT NULL,
  supplier_type text NOT NULL CHECK (supplier_type IN ('penyedia','distributor','donor','lainnya')),
  contact       jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX ix_suppliers_name_trgm ON suppliers USING gin (name gin_trgm_ops);

CREATE TABLE locations (                               -- gudang, depo, ruangan, inventaris, troli emergensi, lab, radiologi
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code           text NOT NULL UNIQUE,
  name           text NOT NULL,
  location_type  text NOT NULL CHECK (location_type IN
                   ('gudang','depo','ruangan','inventaris','troli_emergensi','laboratorium','radiologi','lainnya')),
  parent_id      uuid REFERENCES locations(id),
  holds_stock    boolean NOT NULL DEFAULT true,         -- false = hanya tujuan pengeluaran (mis. sebagian ruangan)
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX ix_locations_parent ON locations(parent_id);

CREATE TABLE user_role_assignments (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES roles(id),
  location_id uuid REFERENCES locations(id),           -- NULL = semua lokasi
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_user_role_location
  ON user_role_assignments (user_id, role_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX ix_ura_user ON user_role_assignments(user_id);

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id   uuid NOT NULL,                            -- rotasi: satu keluarga dicabut bila token lama dipakai ulang
  token_hash  text NOT NULL UNIQUE,                     -- simpan hash, bukan token
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  replaced_by uuid,
  user_agent  text,
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX ix_refresh_tokens_family ON refresh_tokens(family_id);

CREATE TABLE items (                                   -- kodifikasi obat / BMHP
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  code             text NOT NULL UNIQUE,                 -- "Kodifikasi (Huruf) Plus ..." mis. AA0096, BK0001, CL0105-B. Disimpan apa adanya.
  item_type        text NOT NULL CHECK (item_type IN ('obat','bmhp')),
  category_id      uuid NOT NULL REFERENCES item_categories(id),   -- simpul paling dalam
  generic_name     text NOT NULL,
  brand_name       text,
  dosage_form_id   uuid REFERENCES dosage_forms(id),
  strength         text,                                 -- "200mg", "5% / 5 g"
  atc_code         text,
  ddd              numeric(12,4),
  base_unit_id     uuid NOT NULL REFERENCES units(id),   -- satuan kecil: semua qty disimpan dalam satuan ini
  purchase_unit_id uuid REFERENCES units(id),            -- satuan besar (Box, Dus, ...)
  pack_size        numeric(12,3) NOT NULL DEFAULT 1 CHECK (pack_size > 0),  -- isi satuan kecil per satuan besar
  catalog_type     text NOT NULL DEFAULT 'ekatalog' CHECK (catalog_type IN ('ekatalog','non_ekatalog')),
  formulary_status text CHECK (formulary_status IN ('formularium','non_formularium')),
  fornas_class     text CHECK (fornas_class IN ('fornas_generik','fornas_non_generik','non_fornas_non_generik')),
  reference_price  numeric(18,4) CHECK (reference_price >= 0),   -- "Harga Perencanaan"; acuan, BUKAN harga transaksi
  is_active        boolean NOT NULL DEFAULT true,
  legacy_ref       jsonb,                                -- jejak asal baris di spreadsheet (sheet, baris)
  created_by       uuid REFERENCES users(id),
  updated_by       uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX ix_items_category ON items(category_id);
CREATE INDEX ix_items_type_active ON items(item_type) WHERE is_active AND deleted_at IS NULL;
CREATE INDEX ix_items_generic_trgm ON items USING gin (generic_name gin_trgm_ops);
CREATE INDEX ix_items_brand_trgm   ON items USING gin (brand_name gin_trgm_ops);
CREATE INDEX ix_items_code_trgm    ON items USING gin (code gin_trgm_ops);

CREATE TABLE item_planning_params (                    -- safety stock, minimum, kelas moving
  item_id                 uuid PRIMARY KEY REFERENCES items(id),
  safety_stock            numeric(18,3) NOT NULL DEFAULT 0 CHECK (safety_stock >= 0),
  min_stock               numeric(18,3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  moving_class            text CHECK (moving_class IN ('fast_1','fast_2','slow','non_moving')),
  moving_class_is_manual  boolean NOT NULL DEFAULT false,
  moving_class_updated_at timestamptz,
  purchase_note           text,                          -- mis. "beli 1/2 DUS"
  updated_by              uuid REFERENCES users(id),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CHECK (min_stock >= safety_stock)
);

CREATE TABLE item_suppliers (                          -- penyedia/distributor default per item
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  item_id     uuid NOT NULL REFERENCES items(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  relation    text NOT NULL CHECK (relation IN ('penyedia','distributor')),
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, supplier_id, relation)
);
CREATE INDEX ix_item_suppliers_supplier ON item_suppliers(supplier_id);

-- ---------------------------------------------------------------------
-- 3. Perencanaan & pengadaan
-- ---------------------------------------------------------------------

CREATE TABLE procurement_plans (                       -- "Perencanaan 3 Bulan"
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  plan_number   text NOT NULL UNIQUE,
  item_type     text CHECK (item_type IN ('obat','bmhp')),   -- NULL = keduanya
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','closed','cancelled')),
  notes         text,
  created_by    uuid REFERENCES users(id),
  approved_by   uuid REFERENCES users(id),
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end > period_start)
);

CREATE TABLE procurement_plan_items (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  plan_id             uuid NOT NULL REFERENCES procurement_plans(id) ON DELETE CASCADE,
  item_id             uuid NOT NULL REFERENCES items(id),
  planned_qty         numeric(18,3) NOT NULL CHECK (planned_qty >= 0),   -- "A"
  planned_unit_price  numeric(18,4) CHECK (planned_unit_price >= 0),     -- "Harga Perencanaan"
  safety_stock_snap   numeric(18,3),                     -- snapshot saat rencana disusun
  min_stock_snap      numeric(18,3),
  avg_monthly_usage   numeric(18,3),
  notes               text,
  UNIQUE (plan_id, item_id)
);
CREATE INDEX ix_ppi_item ON procurement_plan_items(item_id);

CREATE TABLE purchase_orders (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  po_number        text NOT NULL UNIQUE,
  order_channel    text NOT NULL CHECK (order_channel IN ('manual','e_purchasing')),
  plan_id          uuid REFERENCES procurement_plans(id),
  supplier_id      uuid REFERENCES suppliers(id),        -- nama penyedia
  distributor_id   uuid REFERENCES suppliers(id),        -- nama distributor
  package_id       text,                                 -- "No ID Paket" (e-purchasing)
  ordered_at       date,                                 -- "Tgl Pemesanan PP"
  ppk_released_at  date,                                 -- "Tgl Rilis PDF PPK"
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','submitted','partially_received','completed','cancelled')),
  notes            text,
  created_by       uuid REFERENCES users(id),
  approved_by      uuid REFERENCES users(id),
  approved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX ix_po_status_date ON purchase_orders(status, ordered_at DESC);
CREATE INDEX ix_po_plan ON purchase_orders(plan_id);

CREATE TABLE purchase_order_lines (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  po_id       uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_no     integer NOT NULL,
  item_id     uuid NOT NULL REFERENCES items(id),
  ordered_qty numeric(18,3) NOT NULL CHECK (ordered_qty > 0),   -- satuan kecil
  unit_price  numeric(18,4) NOT NULL CHECK (unit_price >= 0),
  line_status text NOT NULL DEFAULT 'normal' CHECK (line_status IN
                ('normal','pengiriman_parsial','beli_produk_lain','nunggu_kirim','coret_ganti','peningkatan')),
  note        text,
  UNIQUE (po_id, line_no)
);
CREATE INDEX ix_pol_item ON purchase_order_lines(item_id);

CREATE TABLE po_line_schedules (                       -- jadwal kirim per minggu (W1..W5)
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  po_line_id    uuid NOT NULL REFERENCES purchase_order_lines(id) ON DELETE CASCADE,
  month_start   date NOT NULL,
  week_no       smallint NOT NULL CHECK (week_no BETWEEN 1 AND 5),
  scheduled_qty numeric(18,3) NOT NULL CHECK (scheduled_qty >= 0),
  UNIQUE (po_line_id, month_start, week_no)
);

-- ---------------------------------------------------------------------
-- 4. Batch & saldo stok
-- ---------------------------------------------------------------------

-- Satu batch = (item, nomor batch dari surat jalan pabrik/supplier). Harga dan ED melekat di batch.
CREATE TABLE batches (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  item_id          uuid NOT NULL REFERENCES items(id),
  batch_number     text NOT NULL,
  expiry_date      date,
  no_expiry        boolean NOT NULL DEFAULT false,       -- BMHP tertentu tanpa ED (perlu divalidasi)
  unit_cost        numeric(18,4) NOT NULL CHECK (unit_cost >= 0),   -- per satuan kecil
  supplier_id      uuid REFERENCES suppliers(id),
  source_type      text NOT NULL DEFAULT 'pembelian'
                   CHECK (source_type IN ('pembelian','hibah','program','pinjaman','btt','legacy')),
  is_legacy        boolean NOT NULL DEFAULT false,       -- hasil migrasi spreadsheet tanpa nomor batch / ED
  legacy_price_seq integer,                              -- "No. Urut Harga" dari spreadsheet
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, batch_number),
  CHECK (is_legacy OR no_expiry OR expiry_date IS NOT NULL)
);
CREATE INDEX ix_batches_item_expiry ON batches(item_id, expiry_date);
CREATE INDEX ix_batches_expiry ON batches(expiry_date) WHERE expiry_date IS NOT NULL;

-- Saldo per lokasi x batch. Hanya berubah lewat posting mutasi (transaksi yang sama dengan insert ledger).
CREATE TABLE stock_balances (
  location_id uuid NOT NULL REFERENCES locations(id),
  batch_id    uuid NOT NULL REFERENCES batches(id),
  item_id     uuid NOT NULL REFERENCES items(id),        -- denormalisasi untuk query cepat
  quantity    numeric(18,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),  -- jaring pengaman: tidak boleh negatif
  row_version bigint NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, batch_id)
);
CREATE INDEX ix_sb_item_location ON stock_balances(item_id, location_id);
CREATE INDEX ix_sb_batch ON stock_balances(batch_id);
CREATE INDEX ix_sb_location_positive ON stock_balances(location_id, item_id) WHERE quantity > 0;

-- Ledger: append-only, dipartisi bulanan (UTC). PK menyertakan kolom partisi.
CREATE TABLE stock_movements (
  id                  uuid NOT NULL DEFAULT uuid_generate_v7(),
  occurred_at         timestamptz NOT NULL,
  posted_at           timestamptz NOT NULL DEFAULT now(),
  item_id             uuid NOT NULL REFERENCES items(id),
  batch_id            uuid NOT NULL REFERENCES batches(id),
  location_id         uuid NOT NULL REFERENCES locations(id),
  counter_location_id uuid REFERENCES locations(id),     -- lawan transaksi pada transfer
  movement_type       text NOT NULL CHECK (movement_type IN (
                        'opening','receipt','issue','transfer_in','transfer_out',
                        'return_in','return_out','expired','adjustment_in','adjustment_out',
                        'opname_in','opname_out','reversal')),
  quantity            numeric(18,3) NOT NULL CHECK (quantity <> 0),    -- bertanda; satuan kecil
  unit_cost           numeric(18,4) NOT NULL CHECK (unit_cost >= 0),   -- snapshot harga batch saat mutasi
  document_type       text NOT NULL,                     -- receipt, issue, stock_return, stock_adjustment, opname, import
  document_id         uuid NOT NULL,
  document_line_id    uuid,
  reversal_of_id      uuid,                              -- tanpa FK (partisi); divalidasi di aplikasi
  actor_id            uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (id, occurred_at),
  CHECK (
    movement_type = 'reversal'
    OR (movement_type IN ('opening','receipt','transfer_in','return_in','adjustment_in','opname_in') AND quantity > 0)
    OR (movement_type IN ('issue','transfer_out','return_out','expired','adjustment_out','opname_out') AND quantity < 0)
  )
) PARTITION BY RANGE (occurred_at);

CREATE INDEX ix_sm_item_loc_time ON stock_movements(item_id, location_id, occurred_at DESC);
CREATE INDEX ix_sm_batch_time    ON stock_movements(batch_id, occurred_at DESC);
CREATE INDEX ix_sm_document      ON stock_movements(document_type, document_id);
CREATE INDEX ix_sm_time_brin     ON stock_movements USING brin (occurred_at);

CREATE TRIGGER trg_stock_movements_append_only
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ---------------------------------------------------------------------
-- 5. Dokumen transaksi
-- ---------------------------------------------------------------------

CREATE TABLE document_counters (                       -- penomoran dokumen terbaca manusia
  doc_type    text NOT NULL,                             -- RCV, ISS, RET, ADJ, OPN, PO, PLN, REQ
  period      text NOT NULL,                             -- '2026-11'
  last_number bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, period)
);

CREATE TABLE receipts (                                -- penerimaan barang
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  receipt_number       text NOT NULL UNIQUE,
  receipt_date         date NOT NULL,
  location_id          uuid NOT NULL REFERENCES locations(id),   -- lokasi penerima (umumnya gudang)
  supplier_id          uuid REFERENCES suppliers(id),
  source_type          text NOT NULL DEFAULT 'pembelian'
                       CHECK (source_type IN ('pembelian','hibah','program','pinjaman','btt')),
  order_channel        text CHECK (order_channel IN ('manual','e_purchasing')),   -- kolom M / E (diduga; validasi)
  po_id                uuid REFERENCES purchase_orders(id),
  delivery_note_number text,                              -- nomor surat jalan pabrik/supplier
  invoice_number       text,
  status               text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','cancelled')),
  notes                text,
  created_by           uuid REFERENCES users(id),
  posted_by            uuid REFERENCES users(id),
  posted_at            timestamptz,
  cancelled_by         uuid REFERENCES users(id),
  cancelled_at         timestamptz,
  cancel_reason        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_receipts_date ON receipts(receipt_date DESC, id DESC);
CREATE INDEX ix_receipts_supplier ON receipts(supplier_id);
CREATE INDEX ix_receipts_po ON receipts(po_id);
CREATE INDEX ix_receipts_status ON receipts(status) WHERE status = 'draft';

CREATE TABLE receipt_lines (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  receipt_id    uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  line_no       integer NOT NULL,
  item_id       uuid NOT NULL REFERENCES items(id),
  po_line_id    uuid REFERENCES purchase_order_lines(id),
  batch_number  text NOT NULL,                            -- wajib, dari surat jalan
  expiry_date   date,
  no_expiry     boolean NOT NULL DEFAULT false,
  batch_id      uuid REFERENCES batches(id),              -- diisi saat posting
  input_qty     numeric(18,3) NOT NULL CHECK (input_qty > 0),
  input_unit_id uuid NOT NULL REFERENCES units(id),       -- satuan saat input (besar / kecil)
  qty_base      numeric(18,3) NOT NULL CHECK (qty_base > 0),   -- hasil konversi ke satuan kecil
  unit_cost     numeric(18,4) NOT NULL CHECK (unit_cost >= 0), -- per satuan kecil
  UNIQUE (receipt_id, line_no)
);
CREATE INDEX ix_rl_item ON receipt_lines(item_id);
CREATE INDEX ix_rl_po_line ON receipt_lines(po_line_id);
CREATE INDEX ix_rl_batch ON receipt_lines(batch_id);

CREATE TABLE requisitions (                            -- permintaan / amprahan
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  requisition_number text NOT NULL UNIQUE,
  requester_location_id uuid NOT NULL REFERENCES locations(id),   -- ruangan / depo peminta
  supplier_location_id  uuid NOT NULL REFERENCES locations(id),   -- gudang / depo pemberi
  requested_by      uuid REFERENCES users(id),
  requested_at      timestamptz NOT NULL DEFAULT now(),
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN
                      ('draft','submitted','approved','partially_fulfilled','fulfilled','rejected','cancelled')),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_req_status ON requisitions(status, requested_at DESC);
CREATE INDEX ix_req_requester ON requisitions(requester_location_id);

CREATE TABLE requisition_lines (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  requisition_id uuid NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  line_no        integer NOT NULL,
  item_id        uuid NOT NULL REFERENCES items(id),
  requested_qty  numeric(18,3) NOT NULL CHECK (requested_qty > 0),
  approved_qty   numeric(18,3) CHECK (approved_qty >= 0),
  fulfilled_qty  numeric(18,3) NOT NULL DEFAULT 0 CHECK (fulfilled_qty >= 0),
  UNIQUE (requisition_id, line_no)
);
CREATE INDEX ix_reql_item ON requisition_lines(item_id);

CREATE TABLE issues (                                  -- pengeluaran / mutasi
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  issue_number     text NOT NULL UNIQUE,
  issue_type       text NOT NULL CHECK (issue_type IN
                     ('mutasi_depo','amprahan_ruangan','pengeluaran_unit','pengeluaran_btt')),
  issue_date       date NOT NULL,
  from_location_id uuid NOT NULL REFERENCES locations(id),
  to_location_id   uuid NOT NULL REFERENCES locations(id),
  requisition_id   uuid REFERENCES requisitions(id),
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','cancelled')),
  notes            text,
  created_by       uuid REFERENCES users(id),
  posted_by        uuid REFERENCES users(id),
  posted_at        timestamptz,
  cancelled_by     uuid REFERENCES users(id),
  cancelled_at     timestamptz,
  cancel_reason    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (from_location_id <> to_location_id)
);
CREATE INDEX ix_issues_date ON issues(issue_date DESC, id DESC);
CREATE INDEX ix_issues_from ON issues(from_location_id, issue_date DESC);
CREATE INDEX ix_issues_to ON issues(to_location_id, issue_date DESC);
CREATE INDEX ix_issues_req ON issues(requisition_id);

CREATE TABLE issue_lines (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  issue_id   uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  line_no    integer NOT NULL,
  item_id    uuid NOT NULL REFERENCES items(id),
  batch_id   uuid NOT NULL REFERENCES batches(id),        -- hasil FEFO; satu item bisa banyak baris
  quantity   numeric(18,3) NOT NULL CHECK (quantity > 0),
  unit_cost  numeric(18,4) NOT NULL CHECK (unit_cost >= 0),
  UNIQUE (issue_id, line_no)
);
CREATE INDEX ix_il_item ON issue_lines(item_id);
CREATE INDEX ix_il_batch ON issue_lines(batch_id);

CREATE TABLE stock_returns (                           -- retur apotek (ke gudang) dan retur ke PBF
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  return_number    text NOT NULL UNIQUE,
  return_type      text NOT NULL CHECK (return_type IN ('retur_apotek','retur_pbf')),
  return_date      date NOT NULL,
  from_location_id uuid NOT NULL REFERENCES locations(id),
  to_location_id   uuid REFERENCES locations(id),         -- retur_apotek
  supplier_id      uuid REFERENCES suppliers(id),         -- retur_pbf
  reason           text,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','cancelled')),
  created_by       uuid REFERENCES users(id),
  posted_by        uuid REFERENCES users(id),
  posted_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((return_type = 'retur_apotek' AND to_location_id IS NOT NULL)
      OR (return_type = 'retur_pbf' AND supplier_id IS NOT NULL))
);
CREATE INDEX ix_returns_date ON stock_returns(return_date DESC);

CREATE TABLE stock_return_lines (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  return_id  uuid NOT NULL REFERENCES stock_returns(id) ON DELETE CASCADE,
  line_no    integer NOT NULL,
  item_id    uuid NOT NULL REFERENCES items(id),
  batch_id   uuid NOT NULL REFERENCES batches(id),
  quantity   numeric(18,3) NOT NULL CHECK (quantity > 0),
  unit_cost  numeric(18,4) NOT NULL CHECK (unit_cost >= 0),
  note       text,
  UNIQUE (return_id, line_no)
);

CREATE TABLE stock_opname_sessions (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  session_number text NOT NULL UNIQUE,
  location_id    uuid NOT NULL REFERENCES locations(id),
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN
                   ('draft','counting','review','approved','closed','cancelled')),
  snapshot_at    timestamptz,
  started_by     uuid REFERENCES users(id),
  approved_by    uuid REFERENCES users(id),
  approved_at    timestamptz,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_opname_location ON stock_opname_sessions(location_id, created_at DESC);

CREATE TABLE stock_opname_lines (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  session_id  uuid NOT NULL REFERENCES stock_opname_sessions(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES items(id),
  batch_id    uuid NOT NULL REFERENCES batches(id),
  system_qty  numeric(18,3) NOT NULL,
  counted_qty numeric(18,3) CHECK (counted_qty >= 0),
  difference  numeric(18,3) GENERATED ALWAYS AS (counted_qty - system_qty) STORED,
  counted_by  uuid REFERENCES users(id),
  counted_at  timestamptz,
  note        text,
  UNIQUE (session_id, batch_id)
);
CREATE INDEX ix_opl_item ON stock_opname_lines(item_id);

CREATE TABLE stock_adjustments (                       -- expired, rusak, koreksi, selisih opname
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  adjustment_number text NOT NULL UNIQUE,
  adjustment_type   text NOT NULL CHECK (adjustment_type IN ('expired','rusak','koreksi','selisih_opname')),
  location_id       uuid NOT NULL REFERENCES locations(id),
  opname_session_id uuid REFERENCES stock_opname_sessions(id),
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN
                      ('draft','pending_approval','posted','rejected','cancelled')),
  reason            text NOT NULL,
  requested_by      uuid REFERENCES users(id),
  approved_by       uuid REFERENCES users(id),
  approved_at       timestamptz,
  posted_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_adj_location ON stock_adjustments(location_id, created_at DESC);
CREATE INDEX ix_adj_status ON stock_adjustments(status) WHERE status IN ('draft','pending_approval');

CREATE TABLE stock_adjustment_lines (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  adjustment_id  uuid NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  line_no        integer NOT NULL,
  item_id        uuid NOT NULL REFERENCES items(id),
  batch_id       uuid NOT NULL REFERENCES batches(id),
  quantity_delta numeric(18,3) NOT NULL CHECK (quantity_delta <> 0),
  unit_cost      numeric(18,4) NOT NULL CHECK (unit_cost >= 0),
  note           text,
  UNIQUE (adjustment_id, line_no)
);

-- PROVISIONAL (Fase 7): definisi pinjaman perlu divalidasi (poin #9 di PRD).
CREATE TABLE stock_loans (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  loan_number     text NOT NULL UNIQUE,
  direction       text NOT NULL CHECK (direction IN ('pinjam_masuk','pinjam_keluar')),
  counterparty_id uuid REFERENCES suppliers(id),
  receipt_id      uuid REFERENCES receipts(id),
  issue_id        uuid REFERENCES issues(id),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','partially_settled','settled','cancelled')),
  due_date        date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 6. Ringkasan terhitung (agar laporan tidak menjumlahkan ledger setiap kali)
-- ---------------------------------------------------------------------

CREATE TABLE stock_period_summaries (                  -- setara sheet SUMMARY (stok awal, masuk, keluar, akhir)
  item_id        uuid NOT NULL REFERENCES items(id),
  location_id    uuid NOT NULL REFERENCES locations(id),
  period_month   date NOT NULL,                          -- tanggal 1 bulan terkait
  opening_qty    numeric(18,3) NOT NULL DEFAULT 0,
  in_qty         numeric(18,3) NOT NULL DEFAULT 0,
  out_qty        numeric(18,3) NOT NULL DEFAULT 0,
  adjustment_qty numeric(18,3) NOT NULL DEFAULT 0,
  closing_qty    numeric(18,3) NOT NULL DEFAULT 0,
  closing_value  numeric(18,4) NOT NULL DEFAULT 0,
  computed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, location_id, period_month)
);
CREATE INDEX ix_sps_period ON stock_period_summaries(period_month, location_id);

-- ---------------------------------------------------------------------
-- 7. Dukungan platform: audit, idempotensi, outbox, impor
-- ---------------------------------------------------------------------

CREATE TABLE audit_logs (
  id            uuid NOT NULL DEFAULT uuid_generate_v7(),
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_id      uuid,
  action        text NOT NULL,                           -- create, update, delete, post, cancel, approve, login, ...
  entity_type   text NOT NULL,
  entity_id     uuid,
  old_values    jsonb,
  new_values    jsonb,
  request_id    text,
  ip            inet,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
CREATE INDEX ix_audit_entity ON audit_logs(entity_type, entity_id, occurred_at DESC);
CREATE INDEX ix_audit_actor  ON audit_logs(actor_id, occurred_at DESC);
CREATE TRIGGER trg_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TABLE idempotency_keys (                        -- POST posting aman diulang (retry jaringan)
  key           text NOT NULL,
  user_id       uuid NOT NULL REFERENCES users(id),
  request_hash  text NOT NULL,
  response_code integer,
  response_body jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY (user_id, key)
);
CREATE INDEX ix_idem_expires ON idempotency_keys(expires_at);

CREATE TABLE outbox_events (                           -- invalidasi cache, alert, job asinkron
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  aggregate_type text NOT NULL,
  aggregate_id   uuid NOT NULL,
  event_type     text NOT NULL,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz
);
CREATE INDEX ix_outbox_pending ON outbox_events(created_at) WHERE processed_at IS NULL;

CREATE TABLE import_jobs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  import_type text NOT NULL CHECK (import_type IN ('items','opening_balance','receipts_history','suppliers','locations')),
  filename    text NOT NULL,
  file_sha256 text NOT NULL,
  status      text NOT NULL DEFAULT 'uploaded' CHECK (status IN
                ('uploaded','validating','validated','importing','completed','failed')),
  dry_run     boolean NOT NULL DEFAULT true,
  summary     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE import_job_errors (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  job_id     uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  sheet      text,
  row_number integer,
  field      text,
  message    text NOT NULL
);
CREATE INDEX ix_ije_job ON import_job_errors(job_id);

-- ---------------------------------------------------------------------
-- 8. Partisi bulanan
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_month_partition(parent regclass, month_start date) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  from_d    date := date_trunc('month', month_start)::date;
  to_d      date := (date_trunc('month', month_start) + interval '1 month')::date;
  part_name text;
BEGIN
  part_name := format('%s_y%sm%s', parent::text, to_char(from_d, 'YYYY'), to_char(from_d, 'MM'));
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %s FOR VALUES FROM (%L) TO (%L)',
                 part_name, parent,
                 (from_d::timestamp AT TIME ZONE 'UTC'),
                 (to_d::timestamp   AT TIME ZONE 'UTC'));
END $$;

-- Dijalankan terjadwal (worker, tiap bulan): pastikan partisi bulan-bulan ke depan sudah ada.
CREATE OR REPLACE FUNCTION ensure_future_partitions(months_ahead integer DEFAULT 3) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  i integer;
BEGIN
  FOR i IN 0..months_ahead LOOP
    PERFORM create_month_partition('stock_movements', (date_trunc('month', now()) + make_interval(months => i))::date);
    PERFORM create_month_partition('audit_logs',      (date_trunc('month', now()) + make_interval(months => i))::date);
  END LOOP;
END $$;

CREATE TABLE stock_movements_default PARTITION OF stock_movements DEFAULT;
CREATE TABLE audit_logs_default      PARTITION OF audit_logs DEFAULT;

-- Partisi awal: 2026-01 s.d. 2027-12 (data migrasi Mei 2026 dan seterusnya).
DO $$
DECLARE m date := DATE '2026-01-01';
BEGIN
  WHILE m <= DATE '2027-12-01' LOOP
    PERFORM create_month_partition('stock_movements', m);
    PERFORM create_month_partition('audit_logs', m);
    m := (m + interval '1 month')::date;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 9. View turunan
-- ---------------------------------------------------------------------

-- Stok per item x lokasi dengan status (CITO / MENIPIS CITO / MENIPIS / AMAN), sesuai logika spreadsheet.
CREATE VIEW v_item_stock_status AS
SELECT i.id AS item_id,
       l.id AS location_id,
       COALESCE(s.qty, 0) AS quantity,
       COALESCE(p.safety_stock, 0) AS safety_stock,
       COALESCE(p.min_stock, 0)    AS min_stock,
       CASE
         WHEN COALESCE(s.qty, 0) = 0                       THEN 'cito'
         WHEN COALESCE(s.qty, 0) <= COALESCE(p.safety_stock, 0) THEN 'menipis_cito'
         WHEN COALESCE(s.qty, 0) <= COALESCE(p.min_stock, 0)    THEN 'menipis'
         ELSE 'aman'
       END AS stock_status
FROM items i
CROSS JOIN locations l
LEFT JOIN item_planning_params p ON p.item_id = i.id
LEFT JOIN LATERAL (
  SELECT sum(b.quantity) AS qty
  FROM stock_balances b
  WHERE b.item_id = i.id AND b.location_id = l.id
) s ON true
WHERE l.holds_stock AND l.is_active AND i.is_active AND i.deleted_at IS NULL;

-- Penerimaan terposting per baris PO (untuk status pengiriman parsial).
CREATE VIEW v_po_line_received AS
SELECT pl.id AS po_line_id,
       pl.po_id,
       pl.item_id,
       pl.ordered_qty,
       COALESCE(sum(rl.qty_base) FILTER (WHERE r.status = 'posted'), 0) AS received_qty,
       pl.ordered_qty - COALESCE(sum(rl.qty_base) FILTER (WHERE r.status = 'posted'), 0) AS outstanding_qty
FROM purchase_order_lines pl
LEFT JOIN receipt_lines rl ON rl.po_line_id = pl.id
LEFT JOIN receipts r ON r.id = rl.receipt_id
GROUP BY pl.id;

-- Sisa perencanaan = rencana - penerimaan terposting dalam periode rencana (A - (B+C+D)).
CREATE VIEW v_plan_remaining AS
SELECT pi.plan_id,
       pi.item_id,
       pi.planned_qty,
       COALESCE(sum(rl.qty_base), 0) AS received_qty,
       pi.planned_qty - COALESCE(sum(rl.qty_base), 0) AS remaining_qty
FROM procurement_plan_items pi
JOIN procurement_plans pp ON pp.id = pi.plan_id
LEFT JOIN receipts r
       ON r.status = 'posted'
      AND r.source_type = 'pembelian'
      AND r.receipt_date >= pp.period_start
      AND r.receipt_date <= pp.period_end
LEFT JOIN receipt_lines rl
       ON rl.receipt_id = r.id AND rl.item_id = pi.item_id
GROUP BY pi.plan_id, pi.item_id, pi.planned_qty;

-- Utang logistik ke pelayanan = permintaan disetujui yang belum terpenuhi.
CREATE VIEW v_requisition_outstanding AS
SELECT rl.requisition_id, rl.item_id,
       COALESCE(rl.approved_qty, rl.requested_qty) - rl.fulfilled_qty AS outstanding_qty
FROM requisition_lines rl
JOIN requisitions r ON r.id = rl.requisition_id
WHERE r.status IN ('approved','partially_fulfilled')
  AND COALESCE(rl.approved_qty, rl.requested_qty) > rl.fulfilled_qty;

-- ---------------------------------------------------------------------
-- 10. Trigger updated_at otomatis untuk semua tabel yang punya kolom updated_at
-- ---------------------------------------------------------------------
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'updated_at'
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
                   t.table_name, t.table_name);
  END LOOP;
END $$;
