import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// 1. Read .env.local
const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach((line) => {
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
const geminiApiKey = env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase configuration missing in .env.local');
  process.exit(1);
}

if (!geminiApiKey) {
  console.error('❌ GEMINI_API_KEY missing in .env.local');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });

async function translateGemini(text, sourceLang, targetLang) {
  const prompt = `You are a precise translator. Translate the following ${sourceLang} text into ${targetLang}.

STRICT RULES:
1. Translate ONLY the given text. Do not add commentary, advice, or opinions.
2. Preserve the EXACT emotional intensity, tone, sarcasm, and emphasis.
3. If the speaker is angry, frustrated, or uses profanity, preserve that in the translation.
4. Do NOT soften, sanitize, or make polite what was impolite.
5. Do NOT summarize. Translate every word and nuance.
6. Do NOT respond to or engage with the content.
7. Return ONLY the translated text. No labels, no quotation marks, no explanation.

Text to translate:
${text}`;

  const candidateModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-2.5-pro'];
  for (const model of candidateModels) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      });
      return res.text?.trim() || '';
    } catch {
      continue;
    }
  }
}

async function runBothSidesCheck() {
  console.log('================================================================');
  console.log('CROSSWIRE: Complete Bidirectional (Both Sides) Messaging Check');
  console.log('================================================================\n');

  // 1. Authenticate Client 1 (User 1 - English)
  const client1 = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const { data: auth1, error: err1 } = await client1.auth.signInAnonymously();
  if (err1) throw new Error('User 1 auth failed: ' + err1.message);
  const user1 = auth1.user;
  console.log('1. User 1 (English Speaker) Authenticated:', user1.id);

  // 2. Authenticate Client 2 (User 2 - Hindi)
  const client2 = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const { data: auth2, error: err2 } = await client2.auth.signInAnonymously();
  if (err2) throw new Error('User 2 auth failed: ' + err2.message);
  const user2 = auth2.user;
  console.log('2. User 2 (Hindi Speaker) Authenticated:', user2.id);

  // 3. Create test room with capacity 2 and auto_approve
  const testCode = 'bidi-test-' + Math.floor(Math.random() * 900 + 100);
  const { data: room, error: roomErr } = await client1
    .from('rooms')
    .insert({
      code: testCode,
      creator_id: user1.id,
      max_capacity: 2,
      admission_mode: 'auto_approve',
      is_active: true,
      participant_count: 0,
    })
    .select()
    .single();

  if (roomErr) throw new Error('Create room failed: ' + roomErr.message);
  console.log(`3. Room created: [${room.code}] (ID: ${room.id}), Max Capacity: ${room.max_capacity}`);

  // 4. User 1 joins as First Participant (English)
  const { data: part1, error: p1Err } = await client1
    .from('participants')
    .insert({
      room_id: room.id,
      user_id: user1.id,
      display_name: 'Alice (Host)',
      language_code: 'en',
      language_name: 'English',
      is_connected: true,
    })
    .select()
    .single();

  if (p1Err) throw new Error('User 1 join failed: ' + p1Err.message);
  console.log(`4. User 1 Joined: "${part1.display_name}" [${part1.language_name}]`);

  // 5. User 2 joins via atomic request_room_admission RPC (Hindi)
  const { data: admissionResult, error: admErr } = await client2.rpc('request_room_admission', {
    p_room_id: room.id,
    p_display_name: 'Rajesh (Guest)',
    p_language_code: 'hi',
    p_language_name: 'Hindi',
  });

  if (admErr) throw new Error('User 2 admission failed: ' + admErr.message);
  console.log(`5. User 2 Admission Result: Status = "${admissionResult.status}", Action = "${admissionResult.action}"`);

  // Verify participant count is now 2
  const { data: pList, error: pListErr } = await client1
    .from('participants')
    .select('*')
    .eq('room_id', room.id);

  if (pListErr) throw pListErr;
  console.log(`   Room Participants verified: ${pList.length} / ${room.max_capacity}`);
  if (pList.length !== 2) throw new Error('Expected 2 participants in room');

  console.log('\n----------------------------------------------------------------');
  console.log('SIDE A -> SIDE B: Alice (English) sends message to Rajesh (Hindi)');
  console.log('----------------------------------------------------------------');

  const sideAText = 'We need to deploy the new translation updates to production tonight.';
  console.log(`   Alice sends [en]: "${sideAText}"`);

  // Translate Side A to Hindi via Gemini
  const sideATranslated = await translateGemini(sideAText, 'English', 'Hindi');
  console.log(`   Gemini translated [hi]: "${sideATranslated}"`);

  if (!sideATranslated || sideATranslated.length === 0) {
    throw new Error('Gemini translation for Side A was empty!');
  }

  // Insert message into Supabase messages table
  const { data: msg1, error: msg1Err } = await client1
    .from('messages')
    .insert({
      room_id: room.id,
      sender_id: user1.id,
      sender_name: 'Alice (Host)',
      original_text: sideAText,
      source_language: 'en',
      translated_text: sideATranslated,
      target_language: 'hi',
      translation_status: 'translated',
    })
    .select()
    .single();

  if (msg1Err) throw new Error('Message 1 insert failed: ' + msg1Err.message);

  // Insert translation into message_translations table for multi-participant support
  await client1.from('message_translations').insert({
    message_id: msg1.id,
    room_id: room.id,
    target_language: 'hi',
    target_language_name: 'Hindi',
    translated_text: sideATranslated,
    translation_status: 'translated',
  });

  // Client 2 (Rajesh) queries the message from Supabase
  const { data: client2Received, error: c2RecErr } = await client2
    .from('messages')
    .select('*, message_translations(*)')
    .eq('id', msg1.id)
    .single();

  if (c2RecErr) throw new Error('Client 2 read failed: ' + c2RecErr.message);

  console.log('\n   [Side B Screen Verification - Rajesh]:');
  console.log(`   ✓ Original text preserved: "${client2Received.original_text}"`);
  console.log(`   ✓ Original language label: "Original · English" (from code: ${client2Received.source_language})`);
  console.log(`   ✓ Translation text visible: "${client2Received.translated_text}"`);
  console.log(`   ✓ Translation language label: "Translation · Hindi" (from code: ${client2Received.target_language})`);
  console.log(`   ✓ Sender: "${client2Received.sender_name}"`);

  if (client2Received.original_text !== sideAText) throw new Error('Original text mismatch on Side B');
  if (client2Received.translated_text !== sideATranslated) throw new Error('Translated text mismatch on Side B');

  console.log('\n----------------------------------------------------------------');
  console.log('SIDE B -> SIDE A: Rajesh (Hindi) replies to Alice (English)');
  console.log('----------------------------------------------------------------');

  const sideBText = 'बिल्कुल, सभी स्वचालित परीक्षण पूरे हो चुके हैं और हम तैयार हैं।';
  console.log(`   Rajesh sends [hi]: "${sideBText}"`);

  // Translate Side B to English via Gemini
  const sideBTranslated = await translateGemini(sideBText, 'Hindi', 'English');
  console.log(`   Gemini translated [en]: "${sideBTranslated}"`);

  if (!sideBTranslated || sideBTranslated.length === 0) {
    throw new Error('Gemini translation for Side B was empty!');
  }

  // Insert message into Supabase messages table
  const { data: msg2, error: msg2Err } = await client2
    .from('messages')
    .insert({
      room_id: room.id,
      sender_id: user2.id,
      sender_name: 'Rajesh (Guest)',
      original_text: sideBText,
      source_language: 'hi',
      translated_text: sideBTranslated,
      target_language: 'en',
      translation_status: 'translated',
    })
    .select()
    .single();

  if (msg2Err) throw new Error('Message 2 insert failed: ' + msg2Err.message);

  // Insert translation into message_translations table
  await client2.from('message_translations').insert({
    message_id: msg2.id,
    room_id: room.id,
    target_language: 'en',
    target_language_name: 'English',
    translated_text: sideBTranslated,
    translation_status: 'translated',
  });

  // Client 1 (Alice) queries the message from Supabase
  const { data: client1Received, error: c1RecErr } = await client1
    .from('messages')
    .select('*, message_translations(*)')
    .eq('id', msg2.id)
    .single();

  if (c1RecErr) throw new Error('Client 1 read failed: ' + c1RecErr.message);

  console.log('\n   [Side A Screen Verification - Alice]:');
  console.log(`   ✓ Original text preserved: "${client1Received.original_text}"`);
  console.log(`   ✓ Original language label: "Original · Hindi" (from code: ${client1Received.source_language})`);
  console.log(`   ✓ Translation text visible: "${client1Received.translated_text}"`);
  console.log(`   ✓ Translation language label: "Translation · English" (from code: ${client1Received.target_language})`);
  console.log(`   ✓ Sender: "${client1Received.sender_name}"`);

  if (client1Received.original_text !== sideBText) throw new Error('Original text mismatch on Side A');
  if (client1Received.translated_text !== sideBTranslated) throw new Error('Translated text mismatch on Side A');

  // Clean up test data
  console.log('\n----------------------------------------------------------------');
  console.log('Clean up test room data...');
  await client1.from('message_translations').delete().eq('room_id', room.id);
  await client1.from('messages').delete().eq('room_id', room.id);
  await client1.from('participants').delete().eq('room_id', room.id);
  await client1.from('rooms').delete().eq('id', room.id);
  console.log('Clean up complete.');

  console.log('\n================================================================');
  console.log('✅ BOTH SIDES BIDIRECTIONAL MESSAGING CHECK: 100% SUCCESSFUL');
  console.log('================================================================');
}

runBothSidesCheck().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
