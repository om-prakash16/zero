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

const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.ctnzfssmhplsmoqhppsx.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

async function inspect() {
  await client.connect();
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log('Tables in public schema:', tables.rows.map(r => r.table_name));

  const profCols = await client.query("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'profiles';");
  console.log('profiles columns:', profCols.rows);

  const admins = await client.query("SELECT id, email, role FROM public.profiles WHERE role IN ('super_admin', 'superadmin', 'admin');");
  console.log('Current Admins:', admins.rows);

  const authUsers = await client.query("SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;");
  console.log('Sample auth.users:', authUsers.rows);

  await client.end();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
