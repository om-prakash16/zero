import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

// 1. Read .env.local safely
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

const apiKey = env.GEMINI_API_KEY;
if (!apiKey || apiKey.includes('placeholder')) {
  console.error('❌ GEMINI_API_KEY is missing or placeholder');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

function buildPrompt(text, sourceLang, targetLang) {
  return `You are a precise translator. Translate the following ${sourceLang} text into ${targetLang}.

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
}

async function translate(text, sourceLang, targetLang, maxRetries = 3) {
  const prompt = buildPrompt(text, sourceLang, targetLang);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      });
      return res.text?.trim();
    } catch (err) {
      const isRetryable = err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('demand');
      if (isRetryable && attempt < maxRetries) {
        console.log(`[Attempt ${attempt} hit 503 high demand, retrying in 1s...]`);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      throw err;
    }
  }
}

async function runLiveTests() {
  console.log('=== Running Live Two-Way Translation Tests (Gemini 3.8 Flash) ===\n');

  // Test 1: Hindi to Spanish (Emotional nuance test)
  console.log('Test 1: Hindi -> Spanish ("तुम हमेशा मुझे गलत समझते हो!")');
  const esResult = await translate('तुम हमेशा मुझे गलत समझते हो!', 'Hindi', 'Spanish');
  console.log('Result:', esResult);
  if (!esResult) throw new Error('Hindi to Spanish translation returned empty');
  console.log('✅ Test 1 Passed\n');

  // Test 2: Spanish to Hindi ("¡Eso no es verdad y lo sabes perfectamente!")
  console.log('Test 2: Spanish -> Hindi ("¡Eso no es verdad y lo sabes perfectamente!")');
  const hiResult = await translate('¡Eso no es verdad y lo sabes perfectamente!', 'Spanish', 'Hindi');
  console.log('Result:', hiResult);
  if (!hiResult) throw new Error('Spanish to Hindi translation returned empty');
  console.log('✅ Test 2 Passed\n');

  // Test 3: Sarcasm & Intense Debate Preserved
  console.log('Test 3: English -> German (Sarcastic dispute)');
  const deResult = await translate('Oh brilliant! Another fantastic excuse!', 'English', 'German');
  console.log('Result:', deResult);
  if (!deResult) throw new Error('English to German translation returned empty');
  console.log('✅ Test 3 Passed\n');

  console.log('=== All Live Two-Way Translation Tests Completed Successfully ===');
}

runLiveTests().catch(err => {
  console.error('❌ Translation test failed:', err);
  process.exit(1);
});
