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
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;

async function applyMigration() {
  console.log('Connecting to database...');
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected! Reading migration file...');
    const sql = fs.readFileSync('supabase/migrations/005_configurable_capacity_and_join_requests.sql', 'utf-8');
    console.log('Applying migration 005...');
    await client.query(sql);
    console.log('✅ Migration 005 applied successfully!');

    // Verify columns on rooms table
    const cols = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'rooms' AND table_schema = 'public'
    `);
    console.log('Rooms columns:', cols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    // Verify tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await client.end();
  }
}

applyMigration();
