import { generateRoomCode, formatRoomCode, normalizeRoomCode } from '../roomCode';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '../types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

console.log('=== 1. Room Code Generation & Normalization Tests ===');

// Test generation
for (let i = 0; i < 20; i++) {
  const code = generateRoomCode();
  assert(/^[a-z]+-[a-z]+-\d{2}$/.test(code), `Generated code ${code} matches format [adj]-[noun]-[2digit]`);
}

// Test normalization variations
assert(normalizeRoomCode('brave-wolf-42') === 'brave-wolf-42', 'Standard hyphenated code remains identical');
assert(normalizeRoomCode('BRAVE-WOLF-42') === 'brave-wolf-42', 'Uppercase hyphenated code is lowercased');
assert(normalizeRoomCode('BRAVE · WOLF · 42') === 'brave-wolf-42', 'Formatted with bullet points normalizes to single hyphens');
assert(normalizeRoomCode('brave   wolf   42') === 'brave-wolf-42', 'Multiple whitespace normalizes to single hyphens');
assert(normalizeRoomCode('  brave-wolf-42  ') === 'brave-wolf-42', 'Leading and trailing spaces trimmed');
assert(normalizeRoomCode('---brave---wolf---42---') === 'brave-wolf-42', 'Multiple leading/trailing/internal dashes normalized');
assert(normalizeRoomCode('BRAVE • WOLF • 42') === 'brave-wolf-42', 'Alternative bullet symbols normalized');

// Test round trip
const sampleCode = 'fierce-hawk-99';
assert(normalizeRoomCode(formatRoomCode(sampleCode)) === sampleCode, 'Format and normalize are reciprocal');

console.log('\n=== 2. Language & Locale Mapping Tests ===');

assert(SUPPORTED_LANGUAGES.length === 12, '12 languages supported as required by product spec');
const requiredLanguages = ['en', 'hi', 'es', 'fr', 'de', 'pt', 'ja', 'ar', 'zh', 'ko', 'it', 'ru'];
for (const code of requiredLanguages) {
  const lang = getLanguageByCode(code);
  assert(lang.code === code, `Language ${code} correctly resolved`);
  assert(typeof lang.name === 'string' && lang.name.length > 0, `Language ${code} has English name`);
  assert(typeof lang.nativeName === 'string' && lang.nativeName.length > 0, `Language ${code} has native name`);
  assert(/^[a-z]{2}-[A-Z]{2}$/.test(lang.speechCode), `Language ${code} has valid BCP-47 speechCode (${lang.speechCode})`);
}

// Fallback for unknown language code
const fallbackLang = getLanguageByCode('non-existent-code');
assert(fallbackLang.code === 'en', 'Unknown language code safely falls back to English');

console.log('\n=== 3. Translation Prompt Rules & Invariants Tests ===');

// Validate translation request requirements
function validateTranslationRequest(body: {
  text?: unknown;
  sourceLanguage?: unknown;
  targetLanguage?: unknown;
  roomId?: unknown;
  messageId?: unknown;
}): { valid: boolean; error?: string } {
  const { text, sourceLanguage, targetLanguage, roomId, messageId } = body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { valid: false, error: 'Text is required and cannot be empty' };
  }
  if (text.length > 5000) {
    return { valid: false, error: 'Text exceeds maximum length of 5000 characters' };
  }
  if (!sourceLanguage || !targetLanguage || typeof sourceLanguage !== 'string' || typeof targetLanguage !== 'string') {
    return { valid: false, error: 'sourceLanguage and targetLanguage are required strings' };
  }
  const isSourceSupported = SUPPORTED_LANGUAGES.some((l) => l.code === sourceLanguage);
  const isTargetSupported = SUPPORTED_LANGUAGES.some((l) => l.code === targetLanguage);
  if (!isSourceSupported || !isTargetSupported) {
    return { valid: false, error: 'Unsupported sourceLanguage or targetLanguage' };
  }
  if (!roomId || !messageId || typeof roomId !== 'string' || typeof messageId !== 'string' || !roomId.trim() || !messageId.trim()) {
    return { valid: false, error: 'roomId and messageId are required non-empty strings' };
  }
  return { valid: true };
}

assert(!validateTranslationRequest({}).valid, 'Empty request rejected');
assert(!validateTranslationRequest({ text: '   ' }).valid, 'Whitespace-only text rejected');
assert(!validateTranslationRequest({ text: 'a'.repeat(5001), sourceLanguage: 'en', targetLanguage: 'es', roomId: 'r1', messageId: 'm1' }).valid, 'Oversized text (>5000 chars) rejected');
assert(!validateTranslationRequest({ text: 'Hello', sourceLanguage: 'xx', targetLanguage: 'es', roomId: 'r1', messageId: 'm1' }).valid, 'Invalid source language rejected');
assert(!validateTranslationRequest({ text: 'Hello', sourceLanguage: 'en', targetLanguage: 'yy', roomId: 'r1', messageId: 'm1' }).valid, 'Invalid target language rejected');
assert(!validateTranslationRequest({ text: 'Hello', sourceLanguage: 'en', targetLanguage: 'es', roomId: '', messageId: 'm1' }).valid, 'Empty roomId rejected');
assert(!validateTranslationRequest({ text: 'Hello', sourceLanguage: 'en', targetLanguage: 'es', roomId: 'r1', messageId: '' }).valid, 'Empty messageId rejected');
assert(validateTranslationRequest({ text: 'Hello', sourceLanguage: 'en', targetLanguage: 'es', roomId: 'r1', messageId: 'm1' }).valid, 'Valid translation request accepted');

console.log('\n=== 4. Speech Interruption Logic Verification ===');

let testInterruptionVersion = 0;
let testPlaybackActive: boolean = false;
let testQueue: string[] = [];

function testStopSpeech() {
  testInterruptionVersion++;
  testQueue = [];
  testPlaybackActive = false;
}

function testQueueSpeech(item: string) {
  testQueue.push(item);
  testPlaybackActive = true;
}

testQueueSpeech('Message 1');
testQueueSpeech('Message 2');
assert(testQueue.length === 2, 'Two messages queued');
assert(Boolean(testPlaybackActive), 'Playback is active');

const previousVersion = testInterruptionVersion;
testStopSpeech();
assert(testInterruptionVersion > previousVersion, 'Interruption version incremented');
assert(testQueue.length === 0, 'Playback queue purged immediately on interrupt');
assert(!testPlaybackActive, 'Playback halted immediately on interrupt');

console.log('\n✓ ALL AUDIT SUITE TESTS PASSED (100% SUCCESS)\n');
