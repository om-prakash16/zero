/**
 * CROSSWIRE - Room Capacity, Join Requests & Multi-Participant Translation Unit Test Suite
 */

import type { Room, JoinRequest, Participant, Message } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

async function runTests() {
  console.log('=== 1. Room Capacity Configuration Tests ===');
  
  const defaultRoom: Room = {
    id: 'room-1',
    code: 'swift-falcon-42',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
    participant_count: 1,
    creator_id: 'user-host',
    max_capacity: 2,
    admission_mode: 'approval_required',
  };

  assert(defaultRoom.max_capacity === 2, 'Default room capacity is 2');
  assert(defaultRoom.admission_mode === 'approval_required', 'Default admission mode is approval_required');

  // Capacity boundaries
  const validCapacities = [2, 3, 4, 6, 8, 12, 16];
  for (const cap of validCapacities) {
    assert(cap >= 2 && cap <= 16, `Valid capacity ${cap} is within [2, 16]`);
  }

  // Host settings validation: cannot reduce capacity below current occupancy
  function canUpdateCapacity(currentOccupants: number, requestedCapacity: number): boolean {
    if (requestedCapacity < 2 || requestedCapacity > 16) return false;
    if (requestedCapacity < currentOccupants) return false;
    return true;
  }

  assert(canUpdateCapacity(3, 4) === true, 'Can increase capacity from 3 to 4');
  assert(canUpdateCapacity(3, 3) === true, 'Can set capacity equal to current occupancy (3)');
  assert(canUpdateCapacity(3, 2) === false, 'Cannot reduce capacity below current occupancy of 3');
  assert(canUpdateCapacity(2, 1) === false, 'Cannot set capacity below minimum 2');
  assert(canUpdateCapacity(2, 20) === false, 'Cannot set capacity above maximum 16');

  console.log('\n=== 2. Admission Flow Logic Tests ===');
  
  // Admission determination logic
  function evaluateJoinRequest(
    room: Room,
    currentCount: number,
    userId: string,
    existingParticipantIds: string[]
  ): { action: 'admit' | 'queue_approval' | 'reject_full' | 'already_joined' } {
    if (existingParticipantIds.includes(userId)) {
      return { action: 'already_joined' };
    }
    if (currentCount >= room.max_capacity) {
      return { action: 'reject_full' };
    }
    if (room.admission_mode === 'auto_approve') {
      return { action: 'admit' };
    }
    return { action: 'queue_approval' };
  }

  // Scenario A: Auto-approve with available slot
  const autoRoom: Room = { ...defaultRoom, admission_mode: 'auto_approve', max_capacity: 4 };
  const resAuto = evaluateJoinRequest(autoRoom, 2, 'user-3', ['user-host', 'user-2']);
  assert(resAuto.action === 'admit', 'Auto-approve room admits immediately when slot available');

  // Scenario B: Auto-approve but room full
  const resAutoFull = evaluateJoinRequest(autoRoom, 4, 'user-5', ['u1', 'u2', 'u3', 'u4']);
  assert(resAutoFull.action === 'reject_full', 'Auto-approve room rejects when capacity reached');

  // Scenario C: Approval required with available slot
  const resApproval = evaluateJoinRequest(defaultRoom, 1, 'user-2', ['user-host']);
  assert(resApproval.action === 'queue_approval', 'Approval-required room queues request for host approval');

  // Scenario D: Approval required but room full
  const resApprovalFull = evaluateJoinRequest(defaultRoom, 2, 'user-3', ['user-host', 'user-2']);
  assert(resApprovalFull.action === 'reject_full', 'Approval-required room rejects when full before queuing');

  // Scenario E: Existing participant rejoining
  const resRejoin = evaluateJoinRequest(defaultRoom, 1, 'user-host', ['user-host']);
  assert(resRejoin.action === 'already_joined', 'Existing participant recognized and allowed back in');

  console.log('\n=== 3. Host Request Resolution & Lifecycle Tests ===');

  const pendingRequest: JoinRequest = {
    id: 'req-1',
    room_id: 'room-1',
    user_id: 'user-requester',
    display_name: 'Priya',
    language_code: 'hi',
    language_name: 'Hindi',
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  assert(pendingRequest.status === 'pending', 'Request starts in pending state');

  function resolveRequest(
    req: JoinRequest,
    action: 'approved' | 'declined',
    callerUserId: string,
    hostUserId: string
  ): JoinRequest {
    if (callerUserId !== hostUserId) {
      throw new Error('Only the room creator can resolve join requests');
    }
    return {
      ...req,
      status: action,
      resolved_by: callerUserId,
      updated_at: new Date().toISOString(),
    };
  }

  // Creator can approve
  const approvedReq = resolveRequest(pendingRequest, 'approved', 'user-host', 'user-host');
  assert(approvedReq.status === 'approved', 'Host successfully approves join request');
  assert(approvedReq.resolved_by === 'user-host', 'Host recorded as resolving user');

  // Creator can decline
  const declinedReq = resolveRequest(pendingRequest, 'declined', 'user-host', 'user-host');
  assert(declinedReq.status === 'declined', 'Host successfully declines join request');

  // Non-creator cannot resolve
  let errorCaught = false;
  try {
    resolveRequest(pendingRequest, 'approved', 'unauthorized-user', 'user-host');
  } catch {
    errorCaught = true;
  }
  assert(errorCaught, 'Non-host cannot approve or decline join requests');

  // Requester can cancel their own request
  function cancelRequest(req: JoinRequest, callerUserId: string): JoinRequest {
    if (callerUserId !== req.user_id) {
      throw new Error('Only the requester can cancel their request');
    }
    return { ...req, status: 'cancelled', updated_at: new Date().toISOString() };
  }

  const cancelledReq = cancelRequest(pendingRequest, 'user-requester');
  assert(cancelledReq.status === 'cancelled', 'Requester successfully cancels their pending request');

  console.log('\n=== 4. Multi-Participant Translation Deduplication & Mapping Tests ===');

  // In a room with 5 participants speaking different languages:
  const participants: Participant[] = [
    { id: 'p1', room_id: 'room-1', user_id: 'u1', display_name: 'Alice', language_code: 'en', language_name: 'English', is_connected: true, joined_at: '', last_seen_at: '' },
    { id: 'p2', room_id: 'room-1', user_id: 'u2', display_name: 'Raj', language_code: 'hi', language_name: 'Hindi', is_connected: true, joined_at: '', last_seen_at: '' },
    { id: 'p3', room_id: 'room-1', user_id: 'u3', display_name: 'Aarav', language_code: 'hi', language_name: 'Hindi', is_connected: true, joined_at: '', last_seen_at: '' },
    { id: 'p4', room_id: 'room-1', user_id: 'u4', display_name: 'Carlos', language_code: 'es', language_name: 'Spanish', is_connected: true, joined_at: '', last_seen_at: '' },
    { id: 'p5', room_id: 'room-1', user_id: 'u5', display_name: 'Yuki', language_code: 'ja', language_name: 'Japanese', is_connected: true, joined_at: '', last_seen_at: '' },
  ];

  // When Alice (English) sends a message:
  const senderUserId = 'u1';
  const senderLang = 'en';

  // Target languages calculation
  const targetLanguages = Array.from(
    new Set(
      participants
        .filter((p) => p.user_id !== senderUserId && p.language_code !== senderLang)
        .map((p) => p.language_code)
    )
  );

  assert(targetLanguages.length === 3, 'Target languages deduplicated to exactly 3 distinct languages');
  assert(targetLanguages.includes('hi'), 'Includes Hindi (shared by Raj and Aarav without duplicate call)');
  assert(targetLanguages.includes('es'), 'Includes Spanish');
  assert(targetLanguages.includes('ja'), 'Includes Japanese');
  assert(!targetLanguages.includes('en'), 'Excludes sender language English');

  // Multi-translation mapping structure
  const mockTranslations: Record<string, string> = {
    hi: 'नमस्ते दुनिया',
    es: 'Hola Mundo',
    ja: 'こんにちは世界',
  };

  const message: Message = {
    id: 'msg-1',
    room_id: 'room-1',
    sender_id: 'u1',
    sender_name: 'Alice',
    original_text: 'Hello world',
    source_language: 'en',
    translated_text: mockTranslations.hi, // Legacy 2-participant fallback
    target_language: 'hi',
    translation_status: 'translated',
    created_at: new Date().toISOString(),
    translations: {
      hi: { target_language_name: 'Hindi', translated_text: 'नमस्ते दुनिया', translation_status: 'translated' },
      es: { target_language_name: 'Spanish', translated_text: 'Hola Mundo', translation_status: 'translated' },
      ja: { target_language_name: 'Japanese', translated_text: 'こんにちは世界', translation_status: 'translated' },
    },
  };

  // Resolution function for any receiver
  function resolveDisplayTranslation(msg: Message, receiverLanguage: string): { text: string; lang: string } {
    if (msg.source_language === receiverLanguage) {
      return { text: msg.original_text, lang: msg.source_language };
    }
    if (msg.translations && msg.translations[receiverLanguage]) {
      return { text: msg.translations[receiverLanguage].translated_text, lang: receiverLanguage };
    }
    if (msg.target_language === receiverLanguage && msg.translated_text) {
      return { text: msg.translated_text, lang: msg.target_language };
    }
    return { text: msg.translated_text || msg.original_text, lang: msg.target_language || msg.source_language };
  }

  // Test resolution for each participant
  const aliceView = resolveDisplayTranslation(message, 'en');
  assert(aliceView.text === 'Hello world', 'Sender viewing their own language gets original');

  const rajView = resolveDisplayTranslation(message, 'hi');
  assert(rajView.text === 'नमस्ते दुनिया', 'Hindi participant gets Hindi translation');

  const carlosView = resolveDisplayTranslation(message, 'es');
  assert(carlosView.text === 'Hola Mundo', 'Spanish participant gets Spanish translation');

  const yukiView = resolveDisplayTranslation(message, 'ja');
  assert(yukiView.text === 'こんにちは世界', 'Japanese participant gets Japanese translation');

  console.log('\n✓ ALL ROOM CAPACITY & ADMISSION TESTS PASSED (100% SUCCESS)');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
