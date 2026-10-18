import pg from 'pg';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
});

const sql = fs.readFileSync('supabase/migrations/006_superadmin_platform_control.sql', 'utf-8');

const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.ctnzfssmhplsmoqhppsx.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('Connecting to PostgreSQL to apply migration 006...');
  await client.connect();
  console.log('Applying 006_superadmin_platform_control.sql...');
  await client.query(sql);
  console.log('✅ Migration 006 applied successfully!');

  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log('Current public tables:', tables.rows.map(r => r.table_name));

  const superadmins = await client.query("SELECT id, email, role, status FROM public.profiles WHERE role = 'superadmin';");
  console.log('Active Superadmins:', superadmins.rows);

  await client.end();
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
