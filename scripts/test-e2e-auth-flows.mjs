import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import crypto from 'crypto';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach((l) => {
  const idx = l.indexOf('=');
  if (idx !== -1 && !l.trim().startsWith('#')) {
    env[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
  }
});

const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function runE2ETest() {
  console.log('========================================================================');
  console.log('🧪 CROSSWIRE COMPLETE AUTHENTICATION FLOW VERIFICATION SUITE');
  console.log('========================================================================\n');

  const timestamp = Date.now();
  const testEmail = `qa_debater_${timestamp}@testflow2026.org`;
  const initialPassword = `TestPass1_${timestamp}!`;
  const newPassword = `ResetPass2_${timestamp}!`;
  const fullName = `QA Debater ${timestamp}`;

  let createdUserId = null;

  try {
    // -------------------------------------------------------------------------
    // FLOW 1: FIRST-TIME SIGNUP (EMAIL -> OTP -> VERIFY -> CREATE PASSWORD)
    // -------------------------------------------------------------------------
    console.log('▶ [FLOW 1] First-Time Signup Flow...');

    // Step 1: Initial signup call (generates OTP dispatched to email)
    const ephemeralSecret = `${crypto.randomUUID()}${Math.random().toString(36).slice(2)}!Aa9`;
    console.log(`  1.1 Dispathing signup for: ${testEmail}`);
    const { data: signUpData, error: signUpErr } = await anonClient.auth.signUp({
      email: testEmail,
      password: ephemeralSecret,
      options: {
        data: {
          full_name: fullName,
          name: fullName,
          role: 'user',
        },
      },
    });

    if (signUpErr) throw new Error(`Signup request failed: ${signUpErr.message}`);
    if (!signUpData.user?.id) throw new Error('User ID missing from signup response');
    createdUserId = signUpData.user.id;
    console.log(`  ✅ User registration created. User ID: ${createdUserId}`);

    // Verify user is not confirmed yet
    const { data: unconfirmedUser } = await adminClient.auth.admin.getUserById(createdUserId);
    if (unconfirmedUser.user?.email_confirmed_at) {
      throw new Error('User should not be confirmed before OTP is entered!');
    }
    console.log('  ✅ Confirmed: User email is unconfirmed prior to OTP verification.');

    // Step 1.2: Retrieve generated 8-digit OTP from server simulation
    const genLink = await adminClient.auth.admin.generateLink({
      type: 'signup',
      email: testEmail,
      password: ephemeralSecret,
    });
    const signupOtp = genLink.data?.properties?.email_otp;
    if (!signupOtp || signupOtp.length !== 8) {
      throw new Error(`Expected 8-digit numeric OTP, got: ${signupOtp}`);
    }
    console.log(`  ✅ 8-digit numeric signup OTP received: ${signupOtp}`);

    // Step 1.3: Verify incorrect OTP rejection
    const { error: wrongOtpErr } = await anonClient.auth.verifyOtp({
      email: testEmail,
      token: '00000000',
      type: 'signup',
    });
    if (!wrongOtpErr) throw new Error('Incorrect OTP was unexpectedly accepted!');
    console.log('  ✅ Incorrect OTP correctly rejected.');

    // Step 1.4: Verify OTP with type: 'signup'
    const { data: verifyData, error: verifyErr } = await anonClient.auth.verifyOtp({
      email: testEmail,
      token: signupOtp,
      type: 'signup',
    });
    if (verifyErr) throw new Error(`OTP verification failed: ${verifyErr.message}`);
    if (!verifyData.session) throw new Error('Session was not established upon OTP verification');
    console.log('  ✅ Signup OTP verified! Active session established.');

    // Step 1.5: Set permanent password chosen by user
    const { data: updatePwData, error: updatePwErr } = await anonClient.auth.updateUser({
      password: initialPassword,
    });
    if (updatePwErr) throw new Error(`Failed to set user password: ${updatePwErr.message}`);
    console.log('  ✅ Permanent password saved successfully.');

    // Verify email is confirmed in DB
    const { data: confirmedUser } = await adminClient.auth.admin.getUserById(createdUserId);
    if (!confirmedUser.user?.email_confirmed_at) {
      throw new Error('User email should be confirmed after OTP verification!');
    }
    console.log(`  ✅ Account confirmed at: ${confirmedUser.user.email_confirmed_at}`);

    // Sign out to test fresh login
    await anonClient.auth.signOut();
    console.log('  ✅ Flow 1 Completed Successfully.\n');

    // -------------------------------------------------------------------------
    // FLOW 2: NORMAL LOGIN (REGISTERED EMAIL + PASSWORD)
    // -------------------------------------------------------------------------
    console.log('▶ [FLOW 2] Normal Login Flow...');

    // 2.1 Wrong password test
    const { error: wrongLoginErr } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: 'IncorrectPassword123!',
    });
    if (!wrongLoginErr) throw new Error('Login with incorrect password unexpectedly succeeded!');
    console.log('  ✅ Incorrect password successfully rejected.');

    // 2.2 Correct password test
    const { data: loginData, error: loginErr } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: initialPassword,
    });
    if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);
    if (!loginData.session?.access_token) throw new Error('Session token missing after login');
    console.log(`  ✅ Normal login successful! Session acquired for ${loginData.user.email}`);

    // 2.3 Sign out
    await anonClient.auth.signOut();
    console.log('  ✅ Flow 2 Completed Successfully.\n');

    // -------------------------------------------------------------------------
    // FLOW 3: FORGOT PASSWORD (EMAIL -> RECOVERY OTP -> SET NEW PASSWORD)
    // -------------------------------------------------------------------------
    console.log('▶ [FLOW 3] Forgot Password Flow (OTP Verification, No Magic Link)...');

    // 3.1 Request password reset
    const { error: resetReqErr } = await anonClient.auth.resetPasswordForEmail(testEmail);
    if (resetReqErr) throw new Error(`Reset request failed: ${resetReqErr.message}`);
    console.log(`  3.1 Password reset dispatched for: ${testEmail}`);

    // 3.2 Retrieve recovery OTP
    const recoveryLink = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: testEmail,
    });
    const recoveryOtp = recoveryLink.data?.properties?.email_otp;
    if (!recoveryOtp || recoveryOtp.length !== 8) {
      throw new Error(`Expected 8-digit numeric recovery OTP, got: ${recoveryOtp}`);
    }
    console.log(`  ✅ 8-digit numeric recovery OTP received: ${recoveryOtp}`);

    // 3.3 Test verifyOtp with type: 'recovery' (do not use type: signup)
    const { data: recVerifyData, error: recVerifyErr } = await anonClient.auth.verifyOtp({
      email: testEmail,
      token: recoveryOtp,
      type: 'recovery',
    });
    if (recVerifyErr) throw new Error(`Recovery OTP verification failed: ${recVerifyErr.message}`);
    if (!recVerifyData.session) throw new Error('Recovery session missing after OTP verification');
    console.log('  ✅ Recovery OTP verified! Recovery session established.');

    // 3.4 Set and confirm new password
    const { data: newPwData, error: newPwErr } = await anonClient.auth.updateUser({
      password: newPassword,
    });
    if (newPwErr) throw new Error(`Failed to update to new password: ${newPwErr.message}`);
    console.log('  ✅ New password updated successfully.');

    // 3.5 Sign out
    await anonClient.auth.signOut();

    // 3.6 Verify OLD password fails
    const { error: oldPwLoginErr } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: initialPassword,
    });
    if (!oldPwLoginErr) throw new Error('Old password should not work after password reset!');
    console.log('  ✅ Verified: Old password rejected.');

    // 3.7 Verify NEW password succeeds
    const { data: newPwLoginData, error: newPwLoginErr } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: newPassword,
    });
    if (newPwLoginErr) throw new Error(`Login with new password failed: ${newPwLoginErr.message}`);
    if (!newPwLoginData.session) throw new Error('Session missing with new password login');
    console.log(`  ✅ Verified: Login with new password succeeded for ${newPwLoginData.user.email}`);

    await anonClient.auth.signOut();
    console.log('  ✅ Flow 3 Completed Successfully.\n');

    console.log('========================================================================');
    console.log('🎉 ALL THREE AUTHENTICATION FLOWS VERIFIED 100% OPERATIONAL!');
    console.log('========================================================================');
  } catch (err) {
    console.error('❌ E2E Test Failure:', err);
    process.exitCode = 1;
  } finally {
    if (createdUserId) {
      console.log(`\n🧹 Cleaning up test user ${createdUserId}...`);
      await adminClient.auth.admin.deleteUser(createdUserId);
      console.log('✅ Test user cleanly removed from auth.users and profiles.');
    }
  }
}

runE2ETest();
