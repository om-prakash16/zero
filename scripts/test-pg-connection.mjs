import pg from 'pg';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
});

const password = env.SUPABASE_DB_PASSWORD;
const projectRef = 'ctnzfssmhplsmoqhppsx';

const connectionStrings = [
  `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`,
  `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
];

async function tryConnect() {
  for (const connStr of connectionStrings) {
    console.log('Trying connStr:', connStr.replace(password, '****'));
    const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log('✅ Connected successfully to postgres!');
      const res = await client.query('SELECT current_database(), current_user;');
      console.log('Query result:', res.rows[0]);
      await client.end();
      return connStr;
    } catch (e) {
      console.log('❌ Failed:', e.message);
      await client.end().catch(() => {});
    }
  }
}

tryConnect();
