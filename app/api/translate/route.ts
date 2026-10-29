import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getLanguageByCode, SUPPORTED_LANGUAGES } from '@/lib/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Build a precise translation prompt that preserves emotion, intent, and handles code-mixed speech (Hinglish, etc.)
function buildTranslationPrompt(
  text: string,
  sourceLanguageName: string,
  targetLanguageName: string
): string {
  return `You are a real-time live conference translator. Translate the following speech from ${sourceLanguageName} into ${targetLanguageName}.

STRICT RULES:
1. Translate ONLY the given text into natural, fluent ${targetLanguageName}. Do not add commentary, advice, conversational responses, or notes.
2. Handle code-mixing, colloquial expressions, and Hinglish (mix of Hindi and English words written in Latin/Roman or Devanagari script) seamlessly. Decipher the speaker's true intent and translate into clear, grammatically correct ${targetLanguageName}.
3. Keep technical terms, product names, frameworks, and proper nouns accurate (e.g., React, Next.js, APIs, UI).
4. Preserve the EXACT emotional intensity, tone, emphasis, and register (professional, casual, or urgent).
5. Do NOT summarize or shorten. Translate every nuance.
6. Return ONLY the translated text. Do not wrap in quotation marks or labels.

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

  let body: {
    text?: string;
    sourceLanguage?: string;
    targetLanguage?: string;
    targetLanguages?: string[];
    roomId?: string;
    messageId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { text, sourceLanguage, targetLanguage, targetLanguages, roomId, messageId } = body;

  // Validate inputs
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Text is required and cannot be empty' },
      { status: 400 }
    );
  }

  if (!sourceLanguage || typeof sourceLanguage !== 'string') {
    return NextResponse.json(
      { success: false, error: 'sourceLanguage is required string' },
      { status: 400 }
    );
  }

  // Resolve target language list
  const requestedTargets: string[] = Array.isArray(targetLanguages) && targetLanguages.length > 0
    ? targetLanguages
    : targetLanguage ? [targetLanguage] : [];

  if (requestedTargets.length === 0) {
    return NextResponse.json(
      { success: false, error: 'targetLanguage or targetLanguages array is required' },
      { status: 400 }
    );
  }

  const isSourceSupported = SUPPORTED_LANGUAGES.some((l) => l.code === sourceLanguage);
  if (!isSourceSupported) {
    return NextResponse.json(
      { success: false, error: `Unsupported sourceLanguage: ${sourceLanguage}` },
      { status: 400 }
    );
  }

  // Filter to valid unique targets
  const uniqueTargets = Array.from(new Set(requestedTargets)).filter((t) =>
    SUPPORTED_LANGUAGES.some((l) => l.code === t)
  );

  if (uniqueTargets.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No supported target languages found in request' },
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

  // 1. Try high-performance Python FastAPI backend first if available
  const fastapiBaseUrl = process.env.FASTAPI_BACKEND_URL || (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000' : null);
  if (fastapiBaseUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const pyRes = await fetch(`${fastapiBaseUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          source_language: sourceLanguage,
          target_language: uniqueTargets[0],
          target_languages: uniqueTargets,
          room_id: roomId,
          message_id: messageId,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (pyRes.ok) {
        const pyData = await pyRes.json();
        if (pyData && pyData.success && pyData.translations) {
          return NextResponse.json({
            success: true,
            translatedText: pyData.translated_text || pyData.translations[uniqueTargets[0]],
            translations: pyData.translations,
            engine: 'fastapi-python',
          });
        }
      }
    } catch {
      // Python backend not running or timed out; seamlessly fallback to Google GenAI below
    }
  }

  const sourceLang = getLanguageByCode(sourceLanguage);
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const translations: Record<string, string> = {};

  try {
    for (const targetCode of uniqueTargets) {
      if (targetCode === sourceLanguage) {
        translations[targetCode] = text.trim();
        continue;
      }

      const targetLang = getLanguageByCode(targetCode);
      const prompt = buildTranslationPrompt(
        text.trim(),
        sourceLang.name,
        targetLang.name
      );

      let translatedText = '';
      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'];
      let lastErr: unknown = null;

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              temperature: 0.1,
              maxOutputTokens: 2048,
            },
          });

          translatedText = response.text?.trim() ?? '';
          if (translatedText) break;
        } catch (attemptErr: unknown) {
          lastErr = attemptErr;
          // Continue to next candidate model on any failure (404, 429, 503, quota, etc.)
          continue;
        }
      }

      if (!translatedText && lastErr) {
        throw lastErr;
      }

      if (!translatedText) {
        throw new Error(`Empty response from Gemini for target language: ${targetLang.name}`);
      }

      translations[targetCode] = translatedText;
    }

    const firstTarget = uniqueTargets[0];
    const primaryTranslatedText = translations[firstTarget] || text.trim();

    return NextResponse.json({
      success: true,
      translatedText: primaryTranslatedText,
      translations,
    });
  } catch (error: unknown) {
    console.error('Gemini translation error:', error);

    // Return clean user-facing error message as requested
    return NextResponse.json(
      { success: false, error: 'Limit over' },
      { status: 429 }
    );
  }
}
