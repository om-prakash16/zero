/**
 * CROSSWIRE Test Runner - Executes all unit & integration test suites
 */

import { execSync } from 'child_process';

const suites = [
  'lib/__tests__/fullAudit.test.ts',
  'lib/__tests__/roomCode.test.ts',
  'lib/__tests__/roomCapacityAndAdmission.test.ts',
  'lib/__tests__/edgeCasesAndSecurity.test.ts',
  'lib/__tests__/superadminPlatformControl.test.ts',
  'lib/__tests__/seniorQAComprehensiveAudit.test.ts',
  'lib/__tests__/guestRoomAndLan.test.ts',
  'lib/__tests__/mediaDiagnostics.test.ts',
];

console.log('========================================================================');
console.log('CROSSWIRE: Executing Complete Automated Test Suite');
console.log('========================================================================\n');

let totalPassed = 0;

for (const suite of suites) {
  console.log(`\n▶ RUNNING: ${suite}`);
  try {
    execSync(`npx tsx ${suite}`, { encoding: 'utf-8', stdio: 'inherit' });
    totalPassed++;
  } catch {
    console.error(`\n❌ TEST SUITE FAILED: ${suite}`);
    process.exit(1);
  }
}

console.log('\n========================================================================');
console.log(`✅ ALL ${totalPassed} TEST SUITES PASSED SUCCESSFULLY! (100% PASS RATE)`);
console.log('========================================================================');
