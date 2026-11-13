-- Seed minimum: peran dan hak akses. Dijalankan setelah schema.sql (idempoten).

INSERT INTO roles (code, name, is_system) VALUES
  ('admin',            'Admin sistem',                          true),
  ('kepala_depo',      'Apoteker penanggung jawab / Kepala depo', true),
  ('perencana',        'Staf perencanaan & pengadaan',          true),
  ('staf_gudang',      'Staf gudang',                           true),
  ('staf_depo',        'Staf depo',                             true),
  ('peminta_ruangan',  'Peminta ruangan',                       true),
  ('auditor',          'Manajemen / auditor (hanya baca)',      true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, description) VALUES
  ('iam.user.manage',          'Kelola pengguna dan peran'),
  ('master.item.read',         'Lihat master item'),
  ('master.item.write',        'Ubah master item'),
  ('master.supplier.write',    'Ubah supplier'),
  ('master.location.write',    'Ubah lokasi'),
  ('stock.balance.read',       'Lihat stok'),
  ('stock.receipt.write',      'Buat dan ubah draf penerimaan'),
  ('stock.receipt.post',       'Posting penerimaan'),
  ('stock.issue.write',        'Buat dan ubah draf pengeluaran'),
  ('stock.issue.post',         'Posting pengeluaran'),
  ('stock.return.post',        'Posting retur'),
  ('stock.requisition.create', 'Buat permintaan / amprahan'),
  ('stock.requisition.approve','Setujui permintaan'),
  ('stock.adjustment.request', 'Ajukan penyesuaian stok'),
  ('stock.adjustment.approve', 'Setujui penyesuaian stok'),
  ('stock.opname.run',         'Jalankan opname'),
  ('plan.write',               'Susun rencana pengadaan'),
  ('plan.approve',             'Setujui rencana pengadaan'),
  ('po.write',                 'Buat dan ubah PO'),
  ('po.approve',               'Setujui PO'),
  ('report.read',              'Lihat laporan dan dashboard'),
  ('audit.read',               'Lihat jejak audit'),
  ('import.run',               'Jalankan impor data')
ON CONFLICT (code) DO NOTHING;

-- Pemetaan peran -> hak akses
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code FROM roles r JOIN permissions p ON
  (r.code = 'admin'           AND p.code IN ('iam.user.manage','master.item.read','master.item.write','master.supplier.write','master.location.write','import.run','audit.read','report.read'))
  OR (r.code = 'kepala_depo'  AND p.code IN ('master.item.read','master.item.write','stock.balance.read','stock.receipt.post','stock.issue.post','stock.return.post','stock.requisition.approve','stock.adjustment.approve','stock.opname.run','plan.approve','po.approve','report.read','audit.read','import.run'))
  OR (r.code = 'perencana'    AND p.code IN ('master.item.read','master.supplier.write','stock.balance.read','plan.write','po.write','report.read'))
  OR (r.code = 'staf_gudang'  AND p.code IN ('master.item.read','stock.balance.read','stock.receipt.write','stock.receipt.post','stock.issue.write','stock.issue.post','stock.return.post','stock.adjustment.request','stock.opname.run'))
  OR (r.code = 'staf_depo'    AND p.code IN ('master.item.read','stock.balance.read','stock.requisition.create','stock.issue.write','stock.issue.post','stock.return.post','stock.adjustment.request','stock.opname.run'))
  OR (r.code = 'peminta_ruangan' AND p.code IN ('master.item.read','stock.requisition.create'))
  OR (r.code = 'auditor'      AND p.code IN ('master.item.read','stock.balance.read','report.read','audit.read'))
ON CONFLICT DO NOTHING;

-- Akar kategori
INSERT INTO item_categories (item_type, code, name, level, sort_order) VALUES
  ('obat', 'OBAT', 'Obat', 1, 1),
  ('bmhp', 'BMHP', 'BMHP', 1, 2)
ON CONFLICT (code) DO NOTHING;
