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
      const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.8-flash'];
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
          const msg = attemptErr instanceof Error ? attemptErr.message : '';
          const isQuotaOrDown = msg.includes('429') || msg.includes('quota') || msg.includes('503') || msg.includes('demand');
          if (isQuotaOrDown) {
            continue; // try next candidate model
          }
          throw attemptErr;
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
