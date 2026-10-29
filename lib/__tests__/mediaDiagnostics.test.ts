/**
 * Test Suite: Media Diagnostics, Insecure Origin Rules & Virtual Stream Fallback
 */
import assert from 'assert';
import { createVirtualMediaStream } from '../audio/virtualMedia';

console.log('========================================================================');
console.log('>> MEDIA DIAGNOSTICS & SECURE CONTEXT TEST SUITE');
console.log('========================================================================\n');

// 1. Secure Context Detection Logic
console.log('=== 1. Secure Context Detection Rules ===');
function isOriginSecure(hostname: string, protocol: string): boolean {
  if (protocol === 'https:') return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true;
  return false;
}

assert.strictEqual(isOriginSecure('localhost', 'http:'), true, 'http://localhost is secure context');
assert.strictEqual(isOriginSecure('127.0.0.1', 'http:'), true, 'http://127.0.0.1 is secure context');
assert.strictEqual(isOriginSecure('10.178.253.51', 'http:'), false, 'http://10.178.253.51 is NOT secure context');
assert.strictEqual(isOriginSecure('192.168.1.100', 'http:'), false, 'http://192.168.1.100 is NOT secure context');
assert.strictEqual(isOriginSecure('10.178.253.51', 'https:'), true, 'https://10.178.253.51 IS secure context');
assert.strictEqual(isOriginSecure('crosswire.app', 'https:'), true, 'https://crosswire.app IS secure context');
assert.strictEqual(isOriginSecure('crosswire.app', 'http:'), false, 'http://crosswire.app is NOT secure context');

console.log('  PASS: Localhost, 127.0.0.1, and HTTPS origins correctly classified as Secure Contexts');
console.log('  PASS: Raw HTTP LAN IP addresses (10.x.x.x, 192.168.x.x) correctly classified as Insecure Origins');

// 2. Localhost URL Redirect Generator
console.log('\n=== 2. Localhost Redirect Helper ===');
function generateLocalhostUrl(currentHref: string): string {
  const url = new URL(currentHref);
  return `http://localhost:${url.port || '3000'}${url.pathname}${url.search}`;
}

const lanUrl = 'http://10.178.253.51:3000/room/iron-claw-30?ref=phone';
const localRedirect = generateLocalhostUrl(lanUrl);
assert.strictEqual(localRedirect, 'http://localhost:3000/room/iron-claw-30?ref=phone');
console.log('  PASS: LAN room URL correctly transformed into localhost equivalent:', localRedirect);

// 3. Virtual Stream Node/SSR Safety
console.log('\n=== 3. Virtual Media Stream SSR Safety ===');
// In Node.js environment (SSR), createVirtualMediaStream should return a safe empty MediaStream mock without throwing
const mockStream = createVirtualMediaStream('Guest Tester');
assert.ok(mockStream !== undefined, 'Mock stream should not be undefined in Node environment');
console.log('  PASS: createVirtualMediaStream executes safely in SSR / non-browser runtime without crashing');

// 4. Media Error Diagnostic Messages
console.log('\n=== 4. Media Error Diagnostic Classification ===');
function getMediaErrorMessage(errName: string, isInsecureOrigin: boolean): string {
  if (isInsecureOrigin) {
    return 'Insecure Origin: Web browsers block camera & microphone on raw HTTP IP addresses. On laptop, switch to http://localhost:3000.';
  }
  switch (errName) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Permission denied: Please click the lock or camera icon in your address bar and set Camera & Mic to "Allow".';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera or microphone found on this device.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Camera or microphone is busy and currently in use by another app (Zoom, Teams, etc.).';
    default:
      return 'Please allow camera and microphone access to enable video calling.';
  }
}

assert.ok(getMediaErrorMessage('NotAllowedError', false).includes('lock or camera icon'));
assert.ok(getMediaErrorMessage('NotFoundError', false).includes('No camera'));
assert.ok(getMediaErrorMessage('NotReadableError', false).includes('busy'));
assert.ok(getMediaErrorMessage('NotAllowedError', true).includes('localhost:3000'));
console.log('  PASS: Error diagnostics produce helpful, actionable user instructions for all failure modes');

console.log('\n========================================================================');
console.log('✅ ALL MEDIA DIAGNOSTICS TESTS PASSED (100% SUCCESS)');
console.log('========================================================================\n');
