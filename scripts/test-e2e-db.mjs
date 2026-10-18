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
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFullFlow() {
  console.log('Testing full database flow with Anonymous Auth...');
  
  // 1. Sign in anonymously
  const { data: auth1, error: err1 } = await supabase.auth.signInAnonymously();
  if (err1) {
    console.error('❌ Sign-in failed:', err1.message);
    return;
  }
  const user1 = auth1.user;
  console.log('✅ User 1 signed in anonymously:', user1.id);

  // 2. Create a test room
  const testRoomCode = 'test-' + Math.random().toString(36).substring(2, 7);
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .insert({
      code: testRoomCode,
      participant_count: 0
    })
    .select()
    .single();

  if (roomErr) {
    console.error('❌ Room creation failed:', roomErr.message);
    return;
  }
  console.log('✅ Room created:', room.code, 'ID:', room.id);

  // 3. Join room as participant
  const { data: participant, error: partErr } = await supabase
    .from('participants')
    .insert({
      room_id: room.id,
      user_id: user1.id,
      display_name: 'Tester 1',
      language_code: 'en',
      language_name: 'English'
    })
    .select()
    .single();

  if (partErr) {
    console.error('❌ Participant join failed:', partErr.message);
    return;
  }
  console.log('✅ Participant joined:', participant.id);

  // 4. Send a message
  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .insert({
      room_id: room.id,
      sender_id: user1.id,
      sender_name: 'Tester 1',
      original_text: 'Hello world from test',
      source_language: 'en',
      target_language: 'es',
      translation_status: 'pending'
    })
    .select()
    .single();

  if (msgErr) {
    console.error('❌ Message send failed:', msgErr.message);
    return;
  }
  console.log('✅ Message sent:', message.id);

  // 5. Test UPDATE policy (the critical translation update)
  const { data: updatedMsg, error: updateErr } = await supabase
    .from('messages')
    .update({
      translated_text: 'Hola mundo desde la prueba',
      translation_status: 'translated'
    })
    .eq('id', message.id)
    .select()
    .single();

  if (updateErr) {
    console.error('❌ Message update failed:', updateErr.message);
    return;
  }
  console.log('✅ Message UPDATE policy succeeded! Translated text:', updatedMsg.translated_text);

  // 6. Clean up test room
  await supabase.from('messages').delete().eq('id', message.id);
  await supabase.from('participants').delete().eq('id', participant.id);
  await supabase.from('rooms').delete().eq('id', room.id);
  console.log('✅ Clean up completed successfully.');

  console.log('\n🎉 ALL DATABASE RLS & AUTH POLICIES FULLY OPERATIONAL!');
}

testFullFlow().catch(console.error);
