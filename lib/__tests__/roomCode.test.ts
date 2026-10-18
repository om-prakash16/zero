/**
 * Simple unit tests for room code utilities
 * Run with: npx ts-node --project tsconfig.json lib/__tests__/roomCode.test.ts
 * Or integrate with Jest/Vitest as needed.
 */

import { generateRoomCode, formatRoomCode, normalizeRoomCode } from '../roomCode';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

// Test generateRoomCode
const code1 = generateRoomCode();
assert(typeof code1 === 'string', 'generateRoomCode returns a string');
assert(code1.includes('-'), 'Room code contains hyphens');
const parts = code1.split('-');
assert(parts.length === 3, 'Room code has 3 parts');
assert(parts[2].length === 2, 'Room code number part is 2 digits');
const num = parseInt(parts[2], 10);
assert(num >= 10 && num <= 99, 'Room code number is between 10 and 99');

// Test uniqueness (generate 100 codes and check for near-uniqueness)
const codes = new Set(Array.from({ length: 100 }, () => generateRoomCode()));
assert(codes.size > 50, 'Room codes have reasonable uniqueness (>50% unique in 100)');

// Test formatRoomCode
const formatted = formatRoomCode('brave-wolf-42');
assert(formatted === 'BRAVE · WOLF · 42', 'formatRoomCode uppercases and replaces hyphens');

// Test normalizeRoomCode
const normalized = normalizeRoomCode('BRAVE · WOLF · 42');
assert(normalized === 'brave-wolf-42', 'normalizeRoomCode lowercases and cleans separators to single hyphens');

const normalizedSpaced = normalizeRoomCode(' brave   wolf   42 ');
assert(normalizedSpaced === 'brave-wolf-42', 'normalizeRoomCode handles extra spaces');

const normalizedDashed = normalizeRoomCode('brave---wolf---42');
assert(normalizedDashed === 'brave-wolf-42', 'normalizeRoomCode collapses multiple hyphens');

// Test round-trip (normalize after format should equal original code)
const original = 'fierce-hawk-15';
const roundTrip = normalizeRoomCode(formatRoomCode(original));
assert(roundTrip === original, 'Round-trip normalize(format(code)) === code');

console.log('\n✓ All room code tests passed');
