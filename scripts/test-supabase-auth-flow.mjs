import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SECRET_KEY) {
  console.error('❌ Missing environment variables (.env.local)');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function runAuthTests() {
  console.log('========================================================================');
  console.log('🧪 CROSSWIRE SUPABASE AUTHENTICATION SUITE — END-TO-END TEST');
  console.log('========================================================================\n');

  const timestamp = Date.now();
  const testEmail = `debater_${timestamp}@testdomain.org`;
  const testPassword = `DebatePass_${timestamp}!`;
  const testFullName = `Debater QA ${timestamp}`;

  let createdUserId = null;

  try {
    // ---------------------------------------------------------
    // TEST 1: New User Signup with Email & Password
    // ---------------------------------------------------------
    console.log('▶ [TEST 1] New User Signup with Email & Password...');
    const { data: signUpData, error: signUpErr } = await client.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          full_name: testFullName,
          name: testFullName,
        },
      },
    });

    if (signUpErr) throw new Error(`Signup failed: ${signUpErr.message}`);
    if (!signUpData.user?.id) throw new Error('User ID not returned upon signup');

    createdUserId = signUpData.user.id;
    console.log(`  ✅ Signup successful. User ID: ${createdUserId}`);
    console.log(`  ✅ Metadata preserved: ${signUpData.user.user_metadata?.full_name}`);

    // Confirm email directly via admin API so we can test immediate sign-in
    await adminClient.auth.admin.updateUserById(createdUserId, { email_confirm: true });
    console.log('  ✅ Email confirmed for automated test cycle.');

    // ---------------------------------------------------------
    // TEST 2: Duplicate Account Prevention
    // ---------------------------------------------------------
    console.log('\n▶ [TEST 2] Duplicate Account Prevention...');
    const { data: dupData, error: dupErr } = await client.auth.signUp({
      email: testEmail,
      password: 'AnotherPassword123!',
    });

    const isDuplicate =
      !!dupErr ||
      (dupData.user && (!dupData.user.identities || dupData.user.identities.length === 0));

    if (!isDuplicate) {
      throw new Error('Duplicate account signup was not caught!');
    }
    console.log('  ✅ Duplicate signup correctly caught and rejected.');

    // ---------------------------------------------------------
    // TEST 3: User Login with Email & Password
    // ---------------------------------------------------------
    console.log('\n▶ [TEST 3] User Login with Email & Password...');
    const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);
    if (!loginData.session?.access_token) throw new Error('Session access token missing after login');
    console.log(`  ✅ Login successful! Session token acquired for ${loginData.user.email}`);

    // ---------------------------------------------------------
    // TEST 4: Invalid Password Rejection
    // ---------------------------------------------------------
    console.log('\n▶ [TEST 4] Invalid Password Rejection...');
    const { error: badLoginErr } = await client.auth.signInWithPassword({
      email: testEmail,
      password: 'WrongPassword999!',
    });

    if (!badLoginErr) {
      throw new Error('Login with incorrect password unexpectedly succeeded!');
    }
    console.log(`  ✅ Invalid credentials correctly rejected: "${badLoginErr.message}"`);

    // ---------------------------------------------------------
    // TEST 5: Session Persistence & Refresh
    // ---------------------------------------------------------
    console.log('\n▶ [TEST 5] Session Persistence & Token Refresh...');
    const token = loginData.session.access_token;
    const refreshToken = loginData.session.refresh_token;

    const { error: restoreErr } = await client.auth.setSession({
      access_token: token,
      refresh_token: refreshToken,
    });

    if (restoreErr) throw new Error(`Failed to restore session: ${restoreErr.message}`);
    const { data: userCheck } = await client.auth.getUser();
    if (userCheck.user?.id !== createdUserId) {
      throw new Error('Session persistence check failed: User ID mismatch');
    }
    console.log(`  ✅ Session restored and validated across simulated reload for ID: ${userCheck.user.id}`);

    // ---------------------------------------------------------
    // TEST 6: Password Reset Request Flow
    // ---------------------------------------------------------
    console.log('\n▶ [TEST 6] Password Reset Recovery Flow...');
    const { error: resetErr } = await client.auth.resetPasswordForEmail(testEmail, {
      redirectTo: 'http://localhost:3000/auth/callback',
    });

    if (resetErr) throw new Error(`Password reset failed: ${resetErr.message}`);
    console.log(`  ✅ Password reset email dispatched via Supabase for: ${testEmail}`);

    // ---------------------------------------------------------
    // TEST 7: Logout / Sign Out
    // ---------------------------------------------------------
    console.log('\n▶ [TEST 7] User Logout...');
    const { error: signOutErr } = await client.auth.signOut();
    if (signOutErr) throw new Error(`Sign out failed: ${signOutErr.message}`);

    const { data: postLogoutUser } = await client.auth.getUser();
    if (postLogoutUser?.user) {
      throw new Error('User still authenticated after signOut()');
    }
    console.log('  ✅ User successfully signed out. Local session cleared.');

    // ---------------------------------------------------------
    // TEST 8: Public Room Access Without Account (Guest)
    // ---------------------------------------------------------
    console.log('\n▶ [TEST 8] Public Room Access Without Account (Guest Session)...');
    const guestClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: anonData, error: anonErr } = await guestClient.auth.signInAnonymously();

    if (anonErr) throw new Error(`Anonymous guest sign-in failed: ${anonErr.message}`);
    if (!anonData.user?.is_anonymous) {
      throw new Error('Guest session did not have is_anonymous flag set');
    }
    console.log(`  ✅ Unauthenticated guest successfully created anonymous session: ${anonData.user.id}`);

    // ---------------------------------------------------------
    // TEST 9: Protected Superadmin Access Verification
    // ---------------------------------------------------------
    console.log('\n▶ [TEST 9] Protected Superadmin Authentication Verification...');
    const { data: adminLogin, error: adminAuthErr } = await client.auth.signInWithPassword({
      email: 'prakash.om.global@gmail.com',
      password: 'Om@#707916',
    });

    if (adminAuthErr) throw new Error(`Admin login failed: ${adminAuthErr.message}`);
    console.log(`  ✅ Superadmin account logged in: ${adminLogin.user.email}`);

    console.log('\n========================================================================');
    console.log('🎉 ALL 9 SUPABASE AUTHENTICATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================\n');
  } finally {
    // Clean up test user
    if (createdUserId) {
      try {
        await adminClient.auth.admin.deleteUser(createdUserId);
        console.log(`🧹 Cleaned up temporary test user ${createdUserId}`);
      } catch (cleanErr) {
        console.warn('Warning: Failed to clean up test user:', cleanErr.message);
      }
    }
  }
}

runAuthTests().catch((err) => {
  console.error('\n❌ AUTHENTICATION TEST FAILED:\n', err);
  process.exit(1);
});
