import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getLanguageByCode, SUPPORTED_LANGUAGES } from '@/lib/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Build a precise translation prompt that preserves emotion and intent
function buildTranslationPrompt(
  text: string,
  sourceLanguageName: string,
  targetLanguageName: string
): string {
  return `You are a precise translator. Translate the following ${sourceLanguageName} text into ${targetLanguageName}.

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

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error: 'Translation service is not configured. Please set GEMINI_API_KEY.',
      },
      { status: 503 }
    );
  }

  let body: { text?: string; sourceLanguage?: string; targetLanguage?: string; roomId?: string; messageId?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { text, sourceLanguage, targetLanguage, roomId, messageId } = body;

  // Validate inputs
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Text is required and cannot be empty' },
      { status: 400 }
    );
  }

  if (
    !sourceLanguage ||
    !targetLanguage ||
    typeof sourceLanguage !== 'string' ||
    typeof targetLanguage !== 'string'
  ) {
    return NextResponse.json(
      { success: false, error: 'sourceLanguage and targetLanguage are required strings' },
      { status: 400 }
    );
  }

  const isSourceSupported = SUPPORTED_LANGUAGES.some((l) => l.code === sourceLanguage);
  const isTargetSupported = SUPPORTED_LANGUAGES.some((l) => l.code === targetLanguage);

  if (!isSourceSupported || !isTargetSupported) {
    return NextResponse.json(
      { success: false, error: 'Unsupported sourceLanguage or targetLanguage' },
      { status: 400 }
    );
  }

  if (
    !roomId ||
    !messageId ||
    typeof roomId !== 'string' ||
    typeof messageId !== 'string' ||
    !roomId.trim() ||
    !messageId.trim()
  ) {
    return NextResponse.json(
      { success: false, error: 'roomId and messageId are required non-empty strings' },
      { status: 400 }
    );
  }

  if (text.length > 5000) {
    return NextResponse.json(
      { success: false, error: 'Text is too long. Maximum 5000 characters.' },
      { status: 400 }
    );
  }

  if (sourceLanguage === targetLanguage) {
    // Same language: return as-is
    return NextResponse.json({
      success: true,
      translatedText: text.trim(),
    });
  }

  const sourceLang = getLanguageByCode(sourceLanguage);
  const targetLang = getLanguageByCode(targetLanguage);

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const prompt = buildTranslationPrompt(
      text.trim(),
      sourceLang.name,
      targetLang.name
    );

    let translatedText = '';
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            temperature: 0.1, // Low temperature for precise translation
            maxOutputTokens: 2048,
          },
        });

        translatedText = response.text?.trim() ?? '';
        if (translatedText) break;
      } catch (attemptErr: unknown) {
        const msg = attemptErr instanceof Error ? attemptErr.message : '';
        const isRetryable = msg.includes('503') || msg.includes('demand');
        if (isRetryable && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        throw attemptErr;
      }
    }

    if (!translatedText) {
      throw new Error('Empty response from Gemini');
    }

    return NextResponse.json({
      success: true,
      translatedText,
    });
  } catch (error: unknown) {
    console.error('Gemini translation error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Translation failed';

    // Detect rate limit errors
    if (errorMessage.includes('429') || errorMessage.includes('quota')) {
      return NextResponse.json(
        { success: false, error: 'Translation rate limit reached. Please wait a moment.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, error: `Translation failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
