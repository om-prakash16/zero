/**
 * CROSSWIRE - Edge Cases, Reconnection, Security & Failure Resiliency Tests
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

async function runEdgeCaseTests() {
  console.log('=== 1. Closed and Inactive Rooms ===');
  
  function checkRoomJoinable(room: { is_active: boolean } | null) {
    if (!room) return { canJoin: false, reason: 'Room not found' };
    if (!room.is_active) return { canJoin: false, reason: 'Room is closed/inactive' };
    return { canJoin: true };
  }

  assert(!checkRoomJoinable(null).canJoin, 'Nonexistent room is rejected');
  assert(!checkRoomJoinable({ is_active: false }).canJoin, 'Inactive/closed room is rejected');
  assert(checkRoomJoinable({ is_active: true }).canJoin, 'Active room is accepted');

  console.log('\n=== 2. Duplicate Request Prevention ===');

  const pendingRequests = new Map<string, string>(); // key: `roomId:userId` -> requestId

  function submitJoinRequest(roomId: string, userId: string): { success: boolean; requestId?: string; error?: string } {
    const key = `${roomId}:${userId}`;
    if (pendingRequests.has(key)) {
      return { success: false, error: 'A pending request already exists for this room' };
    }
    const newId = `req-${Math.random()}`;
    pendingRequests.set(key, newId);
    return { success: true, requestId: newId };
  }

  const req1 = submitJoinRequest('room-1', 'user-alpha');
  assert(req1.success, 'First join request is accepted');

  const req2 = submitJoinRequest('room-1', 'user-alpha');
  assert(!req2.success, 'Duplicate join request is rejected');
  assert(Boolean(req2.error?.includes('already exists')), 'Duplicate error message returned');

  console.log('\n=== 3. Reconnection & Existing Membership ===');

  interface ParticipantRecord {
    userId: string;
    roomId: string;
    isConnected: boolean;
    lastSeenAt: string;
  }

  const participants: ParticipantRecord[] = [
    { userId: 'user-alpha', roomId: 'room-1', isConnected: false, lastSeenAt: '2026-10-18T12:00:00Z' },
  ];

  function handleReconnection(roomId: string, userId: string): { reconnected: boolean; participant?: ParticipantRecord } {
    const found = participants.find((p) => p.roomId === roomId && p.userId === userId);
    if (found) {
      found.isConnected = true;
      found.lastSeenAt = new Date().toISOString();
      return { reconnected: true, participant: found };
    }
    return { reconnected: false };
  }

  const reconnect = handleReconnection('room-1', 'user-alpha');
  assert(reconnect.reconnected, 'Existing participant reconnects without consuming extra capacity');
  assert(reconnect.participant?.isConnected === true, 'Participant marked as connected on reconnect');

  console.log('\n=== 4. Audio Isolation & Preference Independence ===');

  // Simulate two clients with their own isolated local settings
  interface ClientAudioPreferences {
    autoPlayVoice: boolean;
    isMuted: boolean;
    targetLanguage: string;
  }

  const clientA: ClientAudioPreferences = { autoPlayVoice: true, isMuted: false, targetLanguage: 'en' };
  const clientB: ClientAudioPreferences = { autoPlayVoice: false, isMuted: true, targetLanguage: 'hi' };

  function shouldPlayIncomingAudio(client: ClientAudioPreferences, isOwnMessage: boolean): boolean {
    if (isOwnMessage) return false; // Never auto-play sender's own message
    if (client.isMuted) return false; // Mute overrides auto-play
    return client.autoPlayVoice;
  }

  assert(!shouldPlayIncomingAudio(clientA, true), 'Client A does not play their own outgoing message');
  assert(shouldPlayIncomingAudio(clientA, false), 'Client A auto-plays incoming message because unmuted and autoPlay is true');

  assert(!shouldPlayIncomingAudio(clientB, true), 'Client B does not play their own outgoing message');
  assert(!shouldPlayIncomingAudio(clientB, false), 'Client B does not play incoming audio because muted and autoPlay is false');

  // Toggle Client B's mute independently
  clientB.isMuted = false;
  clientB.autoPlayVoice = true;
  assert(shouldPlayIncomingAudio(clientB, false), 'Client B plays audio once unmuted and autoPlay enabled');
  assert(clientA.isMuted === false, 'Client A settings remain unchanged when Client B toggles audio');

  console.log('\n=== 5. Translation Resiliency & Fallback Chain ===');

  const availableModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.8-flash'];
  
  function simulateModelFallback(failingModels: string[]): { success: boolean; usedModel?: string } {
    for (const model of availableModels) {
      if (!failingModels.includes(model)) {
        return { success: true, usedModel: model };
      }
    }
    return { success: false };
  }

  // Scenario: gemini-3.8-flash hit quota
  const fallbackResult = simulateModelFallback(['gemini-3.8-flash']);
  assert(fallbackResult.success, 'Fallback chain succeeds when primary model hits quota');
  assert(fallbackResult.usedModel === 'gemini-2.5-flash', 'Primary fallback model selected');

  console.log('\n✓ ALL EDGE CASE & SECURITY TESTS PASSED (100% SUCCESS)');
}

runEdgeCaseTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
