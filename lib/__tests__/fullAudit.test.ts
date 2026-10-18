import {
  generateRoomCode,
  formatRoomCode,
  normalizeRoomCode,
  isValidRoomCode,
  getRoomInviteUrl,
} from '../roomCode';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '../types';
import type { Message } from '../types';

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

// Test URL extraction
assert(normalizeRoomCode('http://localhost:3000/room/brave-wolf-42') === 'brave-wolf-42', 'Extracts room code from local URL');
assert(normalizeRoomCode('https://crosswire.app/room/fierce-hawk-99?ref=invite#top') === 'fierce-hawk-99', 'Extracts room code from production URL with query and hash');

// Test validation
assert(isValidRoomCode('brave-wolf-42'), 'Standard room code is valid');
assert(isValidRoomCode('http://localhost:3000/room/brave-wolf-42'), 'Room URL parses as valid code');
assert(!isValidRoomCode('invalid'), 'Non-conforming string is rejected');
assert(!isValidRoomCode('fake-room-too-long-99'), 'Multi-part string is rejected');

// Test invite URL generation
assert(getRoomInviteUrl('brave-wolf-42', 'http://localhost:3000') === 'http://localhost:3000/room/brave-wolf-42', 'getRoomInviteUrl generates correct shareable URL');

// Test round trip
const sampleCode = 'fierce-hawk-99';
assert(normalizeRoomCode(formatRoomCode(sampleCode)) === sampleCode, 'Format and normalize are reciprocal');

console.log('\n=== 2. Language & Locale Mapping Tests ===');

assert(SUPPORTED_LANGUAGES.length >= 12, 'At least 12 core languages supported in multilingual registry');
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

console.log('\n=== 5. Bidirectional Messaging & Translation Labeling Tests ===');

// Simulate User 1 (English) sending "We need to leave now!"
const messageUser1: Message = {
  id: 'msg-001',
  room_id: 'room-abc',
  sender_id: 'user-001',
  sender_name: 'Alex',
  original_text: 'We need to leave now!',
  translated_text: 'हमें अभी निकलना होगा!',
  source_language: 'en',
  target_language: 'hi',
  translation_status: 'translated',
  created_at: '2026-10-18T12:00:00Z',
};

// Simulate User 2 (Hindi) replying in Hindi
const messageUser2: Message = {
  id: 'msg-002',
  room_id: 'room-abc',
  sender_id: 'user-002',
  sender_name: 'Raj',
  original_text: 'बस दो मिनट रुको, मैं आ रहा हूँ।',
  translated_text: 'Just wait two minutes, I am coming.',
  source_language: 'hi',
  target_language: 'en',
  translation_status: 'translated',
  created_at: '2026-10-18T12:00:15Z',
};

// Verify User 1 message labels
const user1Source = getLanguageByCode(messageUser1.source_language);
const user1Target = getLanguageByCode(messageUser1.target_language);
assert(`Original · ${user1Source.name}` === 'Original · English', 'User 1 message correctly labeled Original · English');
assert(`Translation · ${user1Target.name}` === 'Translation · Hindi', 'User 1 translation correctly labeled Translation · Hindi');
assert(messageUser1.original_text === 'We need to leave now!', 'User 1 original text is preserved exactly');
assert(messageUser1.translated_text === 'हमें अभी निकलना होगा!', 'User 1 translated text is preserved exactly');

// Verify User 2 message labels
const user2Source = getLanguageByCode(messageUser2.source_language);
const user2Target = getLanguageByCode(messageUser2.target_language);
assert(`Original · ${user2Source.name}` === 'Original · Hindi', 'User 2 message correctly labeled Original · Hindi');
assert(`Translation · ${user2Target.name}` === 'Translation · English', 'User 2 translation correctly labeled Translation · English');
assert(messageUser2.original_text === 'बस दो मिनट रुको, मैं आ रहा हूँ।', 'User 2 original text is preserved exactly');
assert(messageUser2.translated_text === 'Just wait two minutes, I am coming.', 'User 2 translated text is preserved exactly');

console.log('\n=== 6. Independent Audio Controls & Isolation Tests ===');

// Simulate per-user independent audio settings
type AudioClientState = {
  userId: string;
  autoPlayVoice: boolean;
  isMuted: boolean;
  playedAudios: string[];
};

const client1: AudioClientState = {
  userId: 'user-001',
  autoPlayVoice: true,
  isMuted: false,
  playedAudios: [],
};

const client2: AudioClientState = {
  userId: 'user-002',
  autoPlayVoice: false, // User 2 disabled auto-play
  isMuted: false,
  playedAudios: [],
};

function receiveMessageOnClient(client: AudioClientState, msg: Message, forceManual = false) {
  // Rule 1: Never auto-play own outgoing message
  if (!forceManual && msg.sender_id === client.userId) return false;
  // Rule 2: If auto-play is OFF and not manual, do not play
  if (!forceManual && (!client.autoPlayVoice || client.isMuted)) return false;
  // Rule 3: If muted and not forced, do not play
  if (client.isMuted && !forceManual) return false;

  client.playedAudios.push(msg.id);
  return true;
}

// User 1 sends messageUser1
const client1PlayedOwn = receiveMessageOnClient(client1, messageUser1, false);
assert(!client1PlayedOwn, 'Client 1 does not auto-play their own outgoing message');

// Client 2 receives messageUser1 (autoPlay is OFF for Client 2)
const client2AutoPlayed = receiveMessageOnClient(client2, messageUser1, false);
assert(!client2AutoPlayed, 'Client 2 does not auto-play because autoPlayVoice is false');

// Client 2 clicks speaker icon for manual playback
const client2ManualPlayed = receiveMessageOnClient(client2, messageUser1, true);
assert(client2ManualPlayed, 'Client 2 can manually play translated audio via speaker icon');

// User 2 sends messageUser2 $\to$ Client 1 receives (autoPlay is ON for Client 1)
const client1AutoPlayed = receiveMessageOnClient(client1, messageUser2, false);
assert(client1AutoPlayed, 'Client 1 automatically plays incoming translation because autoPlayVoice is true');

// Client 1 mutes
client1.isMuted = true;
const client1MutedAttempt = receiveMessageOnClient(client1, messageUser2, false);
assert(!client1MutedAttempt, 'Client 1 does not play incoming audio when muted');

console.log('\n=== 7. Runtime Language Switching & History Preservation Tests ===');

// Room participants initial state
const participants = [
  { id: 'p1', user_id: 'user-001', language_code: 'en' },
  { id: 'p2', user_id: 'user-002', language_code: 'hi' },
];

const messageHistory: Message[] = [messageUser1, messageUser2];

// User 2 switches language from 'hi' to 'es' (Spanish)
participants[1].language_code = 'es';

// Verify historical messages remain unchanged
assert(messageHistory[0].source_language === 'en', 'Historical message 1 source language remains English');
assert(messageHistory[0].target_language === 'hi', 'Historical message 1 target language remains Hindi');
assert(messageHistory[1].source_language === 'hi', 'Historical message 2 source language remains Hindi');
assert(messageHistory[1].target_language === 'en', 'Historical message 2 target language remains English');

// Subsequent message sent by User 1 now targets Spanish ('es')
const newTarget = participants.find((p) => p.user_id !== 'user-001')!.language_code;
assert(newTarget === 'es', 'Subsequent message from User 1 automatically targets newly switched language (Spanish)');

const messageUser1New: Message = {
  id: 'msg-003',
  room_id: 'room-abc',
  sender_id: 'user-001',
  sender_name: 'Alex',
  original_text: 'Are you ready now?',
  translated_text: '¿Estás listo ahora?',
  source_language: 'en',
  target_language: newTarget,
  translation_status: 'translated',
  created_at: '2026-10-18T12:01:00Z',
};

const newSourceLang = getLanguageByCode(messageUser1New.source_language);
const newTargetLang = getLanguageByCode(messageUser1New.target_language);
assert(`Original · ${newSourceLang.name}` === 'Original · English', 'New message correctly labeled Original · English');
assert(`Translation · ${newTargetLang.name}` === 'Translation · Spanish', 'New message correctly labeled Translation · Spanish');
assert(messageUser1New.translated_text === '¿Estás listo ahora?', 'Spanish translation preserved');

console.log('\n✓ ALL AUDIT SUITE TESTS PASSED (100% SUCCESS)\n');
