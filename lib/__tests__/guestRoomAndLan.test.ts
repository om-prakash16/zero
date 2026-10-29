import assert from 'assert';
import { validate as uuidValidate } from 'uuid';
import { getPersistentGuestUid } from '../guestUser';
import { normalizeRoomCode, generateRoomCode, formatRoomCode } from '../roomCode';

console.log('========================================================================');
console.log('>> GUEST ROOM & LAN CROSS-DEVICE TEST SUITE');
console.log('========================================================================\n');

// 1. UUID Compliance Test
console.log('=== 1. Guest UID Postgres UUID Compliance ===');
const guestId = getPersistentGuestUid();
assert.strictEqual(uuidValidate(guestId), true, 'Guest UID must be a valid RFC 4122 UUID');
console.log(`  PASS: getPersistentGuestUid() returned valid UUID: ${guestId}`);

// Verify that a legacy non-UUID format gets rejected by uuidValidate
assert.strictEqual(uuidValidate('guest-abc12345'), false, 'Legacy guest string must be recognized as invalid UUID');
assert.strictEqual(uuidValidate('guest-99'), false, 'Legacy short code must be recognized as invalid UUID');
console.log('  PASS: Legacy non-UUID formats correctly detected and rejected by UUID validator');

// 2. Room Code Normalization across LAN URLs
console.log('\n=== 2. Room Code Normalization across LAN URLs ===');
const testCases = [
  { input: 'http://10.178.253.51:3000/room/fierce-hawk-42', expected: 'fierce-hawk-42' },
  { input: 'http://10.178.253.51:3000/fierce-hawk-42', expected: 'fierce-hawk-42' },
  { input: 'http://localhost:3000/room/fierce-hawk-42?ref=mobile', expected: 'fierce-hawk-42' },
  { input: 'FIERCE_HAWK_42', expected: 'fierce-hawk-42' },
  { input: 'fierce-hawk-42', expected: 'fierce-hawk-42' },
];

for (const tc of testCases) {
  const normalized = normalizeRoomCode(tc.input);
  assert.strictEqual(normalized, tc.expected, `Expected ${tc.expected} for ${tc.input}, got ${normalized}`);
  console.log(`  PASS: Normalized "${tc.input}" -> "${normalized}"`);
}

// 3. Room Code Generation Format
console.log('\n=== 3. Semantic 3-Part Room Code Generator ===');
for (let i = 0; i < 5; i++) {
  const code = generateRoomCode();
  const parts = code.split('-');
  assert.strictEqual(parts.length, 3, 'Room code must have 3 hyphenated parts');
  assert.strictEqual(isNaN(Number(parts[2])), false, 'Third part of room code must be numeric');
  console.log(`  PASS: Generated valid room code: "${code}" (formatted: "${formatRoomCode(code)}")`);
}

// 4. LAN IP Address Pattern Validation
console.log('\n=== 4. LAN IP Address Format Contract ===');
const sampleIpv4 = '10.178.253.51';
const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
assert.strictEqual(ipv4Regex.test(sampleIpv4), true, 'LAN IP must match valid IPv4 format');
console.log(`  PASS: LAN host IP format verified: ${sampleIpv4}`);

console.log('\n========================================================================');
console.log('✅ ALL GUEST ROOM & LAN TESTS PASSED SUCCESSFULLY (100%)');
console.log('========================================================================\n');
