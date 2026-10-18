import pg from 'pg';
import fs from 'fs';
import { randomUUID } from 'crypto';

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

const password = env.SUPABASE_DB_PASSWORD;
const projectRef = 'ctnzfssmhplsmoqhppsx';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`✓ PASS: ${message}`);
}

async function runSuperadminDbSecurityTests() {
  console.log('========================================================================');
  console.log('CROSSWIRE: Live Super Admin DB Security & Immutability Test');
  console.log('========================================================================\n');

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  async function setSessionAuthUser(uid) {
    const claims = JSON.stringify({ sub: uid, role: 'authenticated' });
    await client.query(`SELECT set_config('request.jwt.claims', $1, false);`, [claims]);
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [uid]);
  }

  // Find existing bootstrap superadmin
  const saRes = await client.query("SELECT id, email, role, status FROM public.profiles WHERE role = 'superadmin' AND status = 'active' LIMIT 1;");
  assert(saRes.rows.length >= 1, 'At least one active superadmin exists in database');
  const superadminId = saRes.rows[0].id;
  const superadminEmail = saRes.rows[0].email;
  console.log(`Verified active superadmin: ${superadminEmail} (${superadminId})`);

  // Create test dummy user in auth.users
  const dummyUserId = randomUUID();
  const dummyEmail = `user-${Date.now()}@example.com`;

  try {
    console.log('\n--- 1. Testing Role Escalation Prevention ---');
    // Insert dummy user in auth.users
    await client.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
       VALUES ($1, $2, '{"display_name": "Test User"}'::jsonb, NOW(), NOW());`,
      [dummyUserId, dummyEmail]
    );

    // Profile auto-created by trigger
    const profCheck = await client.query('SELECT role, status FROM public.profiles WHERE id = $1', [dummyUserId]);
    assert(profCheck.rows.length === 1, 'User profile auto-created by trigger');
    assert(profCheck.rows[0].role === 'user', 'Ordinary user defaults to role "user"');

    // Simulate ordinary user trying to promote themselves to superadmin
    await setSessionAuthUser(dummyUserId);
    let selfPromotionBlocked = false;
    try {
      await client.query(
        `UPDATE public.profiles SET role = 'superadmin' WHERE id = $1;`,
        [dummyUserId]
      );
    } catch (err) {
      selfPromotionBlocked = err.message.includes('Only active superadmins');
    }
    assert(selfPromotionBlocked, 'Self-role escalation blocked by PostgreSQL trigger');

    // Superadmin updates role
    await setSessionAuthUser(superadminId);
    await client.query(
      `UPDATE public.profiles SET role = 'admin' WHERE id = $1;`,
      [dummyUserId]
    );
    const updatedProf = await client.query('SELECT role FROM public.profiles WHERE id = $1', [dummyUserId]);
    assert(updatedProf.rows[0].role === 'admin', 'Superadmin successfully promoted user to admin');

    console.log('\n--- 2. Testing Protection of Last Active Superadmin ---');
    // Count active superadmins
    const countRes = await client.query("SELECT COUNT(*) FROM public.profiles WHERE role = 'superadmin' AND status = 'active';");
    const count = parseInt(countRes.rows[0].count, 10);
    console.log(`Current active superadmin count: ${count}`);

    if (count === 1) {
      // Attempt to demote sole superadmin
      let demoteBlocked = false;
      try {
        await client.query(
          `UPDATE public.profiles SET role = 'admin' WHERE id = $1;`,
          [superadminId]
        );
      } catch (err) {
        demoteBlocked = err.message.includes('Cannot demote or suspend the last active superadmin');
      }
      assert(demoteBlocked, 'Demoting last superadmin is rejected by trigger');

      // Attempt to suspend sole superadmin
      let suspendBlocked = false;
      try {
        await client.query(
          `UPDATE public.profiles SET status = 'suspended' WHERE id = $1;`,
          [superadminId]
        );
      } catch (err) {
        suspendBlocked = err.message.includes('Cannot demote or suspend the last active superadmin');
      }
      assert(suspendBlocked, 'Suspending last superadmin is rejected by trigger');
    }

    console.log('\n--- 3. Testing Audit Log Immutability ---');
    const logId = randomUUID();
    await client.query(
      `INSERT INTO public.admin_audit_logs (id, admin_id, admin_email, action, target_entity, target_id, details)
       VALUES ($1, $2, $3, 'test_security_audit', 'system', 'test-1', '{"check": true}'::jsonb);`,
      [logId, superadminId, superadminEmail]
    );

    const logCheck = await client.query('SELECT * FROM public.admin_audit_logs WHERE id = $1', [logId]);
    assert(logCheck.rows.length === 1, 'Audit log inserted successfully');

    // Attempt to UPDATE audit log
    let updateBlocked = false;
    try {
      await client.query(`UPDATE public.admin_audit_logs SET action = 'tampered' WHERE id = $1;`, [logId]);
    } catch (err) {
      updateBlocked = err.message.includes('Audit logs are immutable');
    }
    assert(updateBlocked, 'Tampering/Updating audit logs is blocked by immutable trigger');

    // Attempt to DELETE audit log
    let deleteBlocked = false;
    try {
      await client.query(`DELETE FROM public.admin_audit_logs WHERE id = $1;`, [logId]);
    } catch (err) {
      deleteBlocked = err.message.includes('Audit logs are immutable');
    }
    assert(deleteBlocked, 'Deleting audit logs is blocked by immutable trigger');

    console.log('\n--- 4. Testing Moderation Reports Creation & Resolution ---');
    const reportId = randomUUID();
    await client.query(
      `INSERT INTO public.moderation_reports (id, target_type, target_id, reason, status)
       VALUES ($1, 'room', 'room-123', 'Testing report submission', 'pending');`,
      [reportId]
    );

    const repCheck = await client.query('SELECT status FROM public.moderation_reports WHERE id = $1', [reportId]);
    assert(repCheck.rows[0].status === 'pending', 'Moderation report starts as pending');

    await client.query(
      `UPDATE public.moderation_reports 
       SET status = 'resolved', resolution_notes = 'Reviewed by security script', reviewed_by = $1
       WHERE id = $2;`,
      [superadminId, reportId]
    );

    const resolvedCheck = await client.query('SELECT status, resolution_notes FROM public.moderation_reports WHERE id = $1', [reportId]);
    assert(resolvedCheck.rows[0].status === 'resolved', 'Moderation report successfully resolved by superadmin');

    console.log('\n========================================================================');
    console.log('✅ ALL LIVE SUPER ADMIN DB SECURITY TESTS PASSED (100% SUCCESS)');
    console.log('========================================================================');
  } finally {
    // Clean up dummy test user and report
    await client.query('DELETE FROM public.moderation_reports WHERE target_id = $1;', ['room-123']);
    await client.query('DELETE FROM auth.users WHERE id = $1;', [dummyUserId]);
    await client.end();
  }
}

runSuperadminDbSecurityTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
