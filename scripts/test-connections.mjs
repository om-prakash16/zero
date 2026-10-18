import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// 1. Read .env.local
const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      env[key] = val;
    }
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const geminiApiKey = env.GEMINI_API_KEY;

console.log('--- 1. Testing Supabase Connection ---');
console.log('URL:', supabaseUrl);
console.log('Key prefix:', supabaseKey?.slice(0, 15) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabase() {
  try {
    // Test auth anonymous sign in
    console.log('\n[Test 1.1] Testing Anonymous Sign-In...');
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
      console.error('❌ Supabase Auth Error:', authError.message);
      if (authError.message.includes('Anonymous sign-ins are disabled')) {
        console.log('👉 ACTION REQUIRED: Enable "Anonymous sign-ins" in Supabase Dashboard > Authentication > Providers');
      }
    } else {
      console.log('✅ Supabase Anonymous Auth succeeded! User ID:', authData.user?.id);
    }

    // Test tables existence
    console.log('\n[Test 1.2] Checking database tables (rooms, participants, messages)...');
    const { error: roomsError } = await supabase.from('rooms').select('id').limit(1);
    if (roomsError) {
      console.error('❌ Table "rooms" query failed:', roomsError.message);
      if (roomsError.code === '42P01') {
        console.log('👉 ACTION REQUIRED: Migration has not been run yet. Please run 001_initial_schema.sql and 002_messages_update_policy.sql in Supabase SQL Editor.');
      }
    } else {
      console.log('✅ Table "rooms" exists and is queryable!');
    }

    const { error: partError } = await supabase.from('participants').select('id').limit(1);
    if (partError) {
      console.error('❌ Table "participants" query failed:', partError.message);
    } else {
      console.log('✅ Table "participants" exists!');
    }

    const { error: msgError } = await supabase.from('messages').select('id').limit(1);
    if (msgError) {
      console.error('❌ Table "messages" query failed:', msgError.message);
    } else {
      console.log('✅ Table "messages" exists!');
    }
  } catch (err) {
    console.error('❌ Unexpected Supabase error:', err);
  }
}

async function testGemini() {
  console.log('\n--- 2. Testing Gemini Translation API ---');
  console.log('Gemini Key prefix:', geminiApiKey?.slice(0, 8) + '...');
  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Translate "Hello, this is a test argument!" to Spanish. Return ONLY the translation.',
    });
    console.log('✅ Gemini Translation API response:');
    console.log('Output:', response.text?.trim());
  } catch (err) {
    console.error('❌ Gemini API Error:', err.message || err);
  }
}

async function runAll() {
  await testSupabase();
  await testGemini();
  console.log('\n--- Diagnostics Complete ---');
}

runAll();
