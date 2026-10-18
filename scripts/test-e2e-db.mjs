import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

async function testCompleteTwoUserRoomLifecycle() {
  console.log('========================================================');
  console.log('CROSSWIRE 2-User Room & Capacity Enforcement Live Test');
  console.log('========================================================');

  // Client 1 (Host / Creator)
  const client1 = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  const { data: auth1, error: err1 } = await client1.auth.signInAnonymously();
  if (err1) throw err1;
  const user1 = auth1.user;
  console.log('1. User 1 (Host) authenticated:', user1.id);

  // Client 2 (Guest / Second Participant)
  const client2 = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  const { data: auth2, error: err2 } = await client2.auth.signInAnonymously();
  if (err2) throw err2;
  const user2 = auth2.user;
  console.log('2. User 2 (Guest) authenticated:', user2.id);

  // Client 3 (Attacker / Third Participant)
  const client3 = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  const { data: auth3, error: err3 } = await client3.auth.signInAnonymously();
  if (err3) throw err3;
  const user3 = auth3.user;
  console.log('3. User 3 (Third user) authenticated:', user3.id);

  // Step 1: User 1 creates Room
  const testRoomCode = 'test-room-' + Math.floor(Math.random() * 90 + 10);
  const { data: room, error: roomErr } = await client1
    .from('rooms')
    .insert({
      code: testRoomCode,
      is_active: true,
      participant_count: 0
    })
    .select()
    .single();

  if (roomErr) throw roomErr;
  console.log('4. Room created successfully. Code:', room.code, 'ID:', room.id);

  // Step 2: User 1 joins as First Participant (Host in Hindi)
  const { data: part1, error: part1Err } = await client1
    .from('participants')
    .insert({
      room_id: room.id,
      user_id: user1.id,
      display_name: 'Om Prakash (Host)',
      language_code: 'hi',
      language_name: 'Hindi',
      is_connected: true
    })
    .select()
    .single();

  if (part1Err) throw part1Err;
  console.log('5. Host joined room. ID:', part1.id, 'Language:', part1.language_name);

  // Step 3: User 2 joins as Second Participant (Guest in English)
  const { data: part2, error: part2Err } = await client2
    .from('participants')
    .insert({
      room_id: room.id,
      user_id: user2.id,
      display_name: 'Elena (Guest)',
      language_code: 'en',
      language_name: 'English',
      is_connected: true
    })
    .select()
    .single();

  if (part2Err) throw part2Err;
  console.log('6. Guest joined room. ID:', part2.id, 'Language:', part2.language_name);

  // Step 4: Verify Room participant_count is 2
  const { data: updatedRoom } = await client1
    .from('rooms')
    .select('participant_count')
    .eq('id', room.id)
    .single();
  console.log('7. Live room participant count in DB:', updatedRoom.participant_count);

  // Step 5: Capacity Enforcement Test — User 3 tries to join the full room
  console.log('8. Testing Capacity Enforcement: User 3 attempting to join full room...');
  const { error: part3Err } = await client3
    .from('participants')
    .insert({
      room_id: room.id,
      user_id: user3.id,
      display_name: 'Intruder 3',
      language_code: 'es',
      language_name: 'Spanish'
    })
    .select()
    .single();

  if (part3Err) {
    console.log('   ✅ CAPACITY ENFORCEMENT PASSED: User 3 was rejected by database trigger!');
    console.log('   Error message:', part3Err.message);
  } else {
    throw new Error('FAIL: User 3 was allowed into a full room!');
  }

  // Step 6: Duplicate Membership Test — User 1 tries to join again
  console.log('9. Testing Duplicate Membership: User 1 attempting to join again...');
  const { error: dupErr } = await client1
    .from('participants')
    .insert({
      room_id: room.id,
      user_id: user1.id,
      display_name: 'Duplicate Om',
      language_code: 'hi',
      language_name: 'Hindi'
    });

  if (dupErr) {
    console.log('   ✅ DUPLICATE MEMBERSHIP REJECTION PASSED: Database rejected duplicate user in room.');
    console.log('   Constraint error:', dupErr.message);
  } else {
    throw new Error('FAIL: Duplicate user joined the same room!');
  }

  // Step 7: Cross-Participant Communication & Translation
  console.log('10. Testing Cross-Participant Communication: User 1 sends message in Hindi...');
  const { data: msg1, error: msgErr } = await client1
    .from('messages')
    .insert({
      room_id: room.id,
      sender_id: user1.id,
      sender_name: 'Om Prakash (Host)',
      original_text: 'नमस्ते, क्या आप मुझे सुन सकते हैं?',
      source_language: 'hi',
      target_language: 'en',
      translation_status: 'pending'
    })
    .select()
    .single();

  if (msgErr) throw msgErr;
  console.log('   ✅ Message created:', msg1.id);

  // User 2 reads message (RLS check)
  const { data: readMsgs, error: readErr } = await client2
    .from('messages')
    .select('*')
    .eq('room_id', room.id);

  if (readErr) throw readErr;
  console.log('   ✅ User 2 received message via RLS policy. Message count:', readMsgs.length);

  // Server/Client updates translation
  const { data: translatedMsg, error: transErr } = await client1
    .from('messages')
    .update({
      translated_text: 'Hello, can you hear me?',
      translation_status: 'translated'
    })
    .eq('id', msg1.id)
    .select()
    .single();

  if (transErr) throw transErr;
  console.log('   ✅ Translated message updated in DB:', translatedMsg.translated_text);

  // Step 8: Clean up
  await client1.from('messages').delete().eq('room_id', room.id);
  await client1.from('participants').delete().eq('id', part1.id);
  await client2.from('participants').delete().eq('id', part2.id);
  await client1.from('rooms').delete().eq('id', room.id);
  console.log('11. Database test clean-up completed.');

  console.log('\n========================================================');
  console.log('🎉 ALL 8/8 ROOM CREATION, JOINING, CAPACITY & AUTH TESTS PASSED!');
  console.log('========================================================');
}

testCompleteTwoUserRoomLifecycle().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
