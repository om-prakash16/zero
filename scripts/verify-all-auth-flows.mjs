import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read local env
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SECRET_KEY = env.SUPABASE_SECRET_KEY;

const adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const timestamp = Date.now();
const testEmail = `qa-verify-${timestamp}@example.com`;
const testName = 'QA Tester';
const initialPassword = 'InitialSecretPass123!';
const newPassword = 'NewUpdatedPass456!';

let createdUserId = null;

async function run() {
  console.log('====================================================');
  console.log('CROSSWIRE E2E AUTHENTICATION VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  try {
    // ----------------------------------------------------
    // TEST 1: SIGNUP FLOW (Send OTP -> Verify -> Create Password)
    // ----------------------------------------------------
    console.log('▶ [TEST 1] Testing New User Signup Flow...');
    
    // 1a. Generate signup OTP link/token using admin client (simulating server route)
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'signup',
      email: testEmail,
      password: crypto.randomUUID() + '!Aa1',
      options: {
        data: {
          full_name: testName,
          name: testName,
          role: 'user'
        }
      }
    });

    if (linkErr) throw new Error(`Generate signup link failed: ${linkErr.message}`);
    const signupOtp = linkData.properties?.email_otp;
    createdUserId = linkData.user?.id;
    console.log(`  ✓ Generated signup OTP code: [${signupOtp}] (Length: ${signupOtp.length})`);
    console.log(`  ✓ Created user record ID: ${createdUserId}`);

    // 1b. Verify signup OTP with client
    const { data: verifyData, error: verifyErr } = await client.auth.verifyOtp({
      email: testEmail,
      token: signupOtp,
      type: 'signup'
    });

    if (verifyErr) throw new Error(`Verify signup OTP failed: ${verifyErr.message}`);
    console.log(`  ✓ Signup OTP successfully verified by Supabase Auth!`);
    console.log(`  ✓ Session established: User ID = ${verifyData.user?.id}`);

    // 1c. Create and set initial password
    const { data: pwdData, error: pwdErr } = await client.auth.updateUser({
      password: initialPassword
    });

    if (pwdErr) throw new Error(`Set initial password failed: ${pwdErr.message}`);
    console.log(`  ✓ Password securely set for verified user`);

    // 1d. Check profile created in public.profiles
    const { data: profileData, error: profErr } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', createdUserId)
      .single();

    if (profErr || !profileData) {
      console.log(`  ⚠ Profile warning (may be auto-created on login): ${profErr?.message}`);
    } else {
      console.log(`  ✓ User profile confirmed in database: role = ${profileData.role}, email = ${profileData.email}`);
    }

    // ----------------------------------------------------
    // TEST 2: NORMAL LOGIN & WRONG PASSWORD
    // ----------------------------------------------------
    console.log('\n▶ [TEST 2] Testing Password Login...');
    
    // 2a. Sign out first
    await client.auth.signOut();

    // 2b. Test wrong password
    const { data: badLoginData, error: badLoginErr } = await client.auth.signInWithPassword({
      email: testEmail,
      password: 'CompletelyWrongPassword!'
    });
    if (!badLoginErr) throw new Error('Expected invalid login to fail, but it succeeded!');
    console.log(`  ✓ Invalid password safely rejected with error: "${badLoginErr.message}"`);

    // 2c. Test correct password
    const { data: goodLoginData, error: goodLoginErr } = await client.auth.signInWithPassword({
      email: testEmail,
      password: initialPassword
    });
    if (goodLoginErr) throw new Error(`Valid password login failed: ${goodLoginErr.message}`);
    console.log(`  ✓ Valid credentials successfully authenticated! Session token issued.`);

    // ----------------------------------------------------
    // TEST 3: FORGOT PASSWORD RECOVERY (OTP -> Set New Password)
    // ----------------------------------------------------
    console.log('\n▶ [TEST 3] Testing Password Recovery Flow...');

    // 3a. Generate recovery OTP
    const { data: recLinkData, error: recLinkErr } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: testEmail
    });
    if (recLinkErr) throw new Error(`Generate recovery link failed: ${recLinkErr.message}`);
    const recoveryOtp = recLinkData.properties?.email_otp;
    console.log(`  ✓ Generated recovery OTP code: [${recoveryOtp}] (Length: ${recoveryOtp.length})`);

    // 3b. Verify recovery OTP
    const recoveryClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: recVerifyData, error: recVerifyErr } = await recoveryClient.auth.verifyOtp({
      email: testEmail,
      token: recoveryOtp,
      type: 'recovery'
    });
    if (recVerifyErr) throw new Error(`Verify recovery OTP failed: ${recVerifyErr.message}`);
    console.log(`  ✓ Recovery OTP successfully verified! Authenticated recovery session active.`);

    // 3c. Update password using recovery session
    const { error: newPwdErr } = await recoveryClient.auth.updateUser({
      password: newPassword
    });
    if (newPwdErr) throw new Error(`Update password via recovery failed: ${newPwdErr.message}`);
    console.log(`  ✓ New password successfully updated.`);

    // 3d. Verify OLD password no longer works
    const { error: oldPwdAttemptErr } = await client.auth.signInWithPassword({
      email: testEmail,
      password: initialPassword
    });
    if (!oldPwdAttemptErr) throw new Error('Old password should have been rejected!');
    console.log(`  ✓ Old password confirmed invalidated: "${oldPwdAttemptErr.message}"`);

    // 3e. Verify NEW password works
    const { data: newPwdLoginData, error: newPwdLoginErr } = await client.auth.signInWithPassword({
      email: testEmail,
      password: newPassword
    });
    if (newPwdLoginErr) throw new Error(`New password login failed: ${newPwdLoginErr.message}`);
    console.log(`  ✓ Successfully signed in with NEW password!`);

    // ----------------------------------------------------
    // TEST 4: PRESERVED ADMIN ACCOUNTS VERIFICATION
    // ----------------------------------------------------
    console.log('\n▶ [TEST 4] Verifying Preserved Admins...');
    const { data: adminProfiles } = await adminClient
      .from('profiles')
      .select('email, role, status')
      .in('email', ['prakash.om.global@gmail.com', 'employee@crosswire.com']);

    console.log('  Active Admin Profiles in DB:');
    adminProfiles.forEach(p => {
      console.log(`    - ${p.email} [Role: ${p.role.toUpperCase()}] [Status: ${p.status}]`);
    });

    const superAdmin = adminProfiles.find(p => p.role === 'superadmin');
    const admin = adminProfiles.find(p => p.role === 'admin');

    if (!superAdmin) throw new Error('Superadmin profile missing!');
    if (!admin) throw new Error('Employee Admin profile missing!');
    console.log('  ✓ Both Super Admin and Employee Admin verified intact!');

    // ----------------------------------------------------
    // CLEANUP TEMPORARY USER
    // ----------------------------------------------------
    if (createdUserId) {
      await adminClient.auth.admin.deleteUser(createdUserId);
      console.log(`\n▶ [CLEANUP] Deleted temporary test user ${testEmail} (${createdUserId})`);
    }

    console.log('\n====================================================');
    console.log('ALL TESTS PASSED WITH 100% SUCCESS!');
    console.log('====================================================');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    if (createdUserId) {
      await adminClient.auth.admin.deleteUser(createdUserId).catch(() => {});
    }
    process.exit(1);
  }
}

run();
