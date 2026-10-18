// CROSSWIRE — Shared TypeScript Types

export type Language = {
  code: string;
  name: string;
  nativeName: string;
  speechCode: string; // BCP-47 code for Web Speech API
};

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', speechCode: 'en-US' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', speechCode: 'hi-IN' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', speechCode: 'es-ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', speechCode: 'fr-FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', speechCode: 'de-DE' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', speechCode: 'pt-BR' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', speechCode: 'ja-JP' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', speechCode: 'ar-SA' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', speechCode: 'zh-CN' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', speechCode: 'ko-KR' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', speechCode: 'it-IT' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', speechCode: 'ru-RU' },
];

export function getLanguageByCode(code: string): Language {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) ?? SUPPORTED_LANGUAGES[0];
}

// Database row types
export type Room = {
  id: string;
  code: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  participant_count: number;
};

export type Participant = {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  language_code: string;
  language_name: string;
  is_connected: boolean;
  joined_at: string;
  last_seen_at: string;
};

export type Message = {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  original_text: string;
  translated_text: string | null;
  source_language: string;
  target_language: string;
  translation_status: 'pending' | 'translated' | 'failed';
  created_at: string;
};

// UI State Types
export type ConversationStatus =
  | 'idle'
  | 'listening'
  | 'speaking'
  | 'translating'
  | 'playing'
  | 'interrupted'
  | 'waiting'
  | 'error';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export type SpeechRecognitionStatus =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'processing'
  | 'error'
  | 'unsupported';

export type RoomJoinInfo = {
  displayName: string;
  languageCode: string;
};

export type TranslateRequest = {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  roomId: string;
  messageId: string;
};

export type TranslateResponse = {
  translatedText: string;
  success: boolean;
  error?: string;
};
