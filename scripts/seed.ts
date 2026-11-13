import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as argon2 from 'argon2';

dotenv.config();

async function runSeed() {
  const databaseUrl = process.env.DATABASE_URL || 'postgres://depo:depo@localhost:5432/depo_dev';
  const client = new Client({ connectionString: databaseUrl });

  const maskedUrl = databaseUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`Menghubungkan ke database: ${maskedUrl}`);

  await client.connect();

  const seedSqlPath = path.resolve(__dirname, '../docs/database/seed.sql');
  const seedSql = fs.readFileSync(seedSqlPath, 'utf8');

  console.log('Menerapkan docs/database/seed.sql (roles, permissions, kategori)...');
  await client.query(seedSql);
  console.log('Seed peran dan hak akses berhasil diterapkan!');

  // Seed default admin user jika belum ada
  const checkAdmin = await client.query("SELECT id FROM users WHERE username = 'admin'");
  if (checkAdmin.rows.length === 0) {
    console.log('Membuat akun default admin (username: admin)...');
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'AdminDepo123!';
    const passwordHash = await argon2.hash(defaultPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const userRes = await client.query(
      `INSERT INTO users (username, email, full_name, password_hash, must_change_password)
       VALUES ('admin', 'admin@hospital.local', 'Administrator Sistem', $1, true)
       RETURNING id`,
      [passwordHash],
    );

    const adminUserId = userRes.rows[0].id;
    const roleRes = await client.query("SELECT id FROM roles WHERE code = 'admin'");
    if (roleRes.rows.length > 0) {
      const adminRoleId = roleRes.rows[0].id;
      await client.query(
        `INSERT INTO user_role_assignments (user_id, role_id, location_id)
         VALUES ($1, $2, NULL)
         ON CONFLICT DO NOTHING`,
        [adminUserId, adminRoleId],
      );
    }
    console.log(`Akun admin berhasil dibuat! Default password: ${defaultPassword} (wajib diganti saat login pertama)`);
  } else {
    console.log('Akun admin sudah ada.');
  }

  await client.end();
}

runSeed().catch((err) => {
  console.error('Gagal menerapkan seed:', err.message);
  process.exit(1);
});
