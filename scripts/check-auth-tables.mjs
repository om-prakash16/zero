import pg from 'pg';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(l => {
  const idx = l.indexOf('=');
  if (idx !== -1 && !l.trim().startsWith('#')) env[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
});

const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.ctnzfssmhplsmoqhppsx.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const ottCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'one_time_tokens';");
  console.log('one_time_tokens columns:', ottCols.rows);

  const tokens = await client.query("SELECT * FROM auth.one_time_tokens ORDER BY created_at DESC LIMIT 5;");
  console.log('Sample tokens:', tokens.rows);
  await client.end();
}

run().catch(console.error);
