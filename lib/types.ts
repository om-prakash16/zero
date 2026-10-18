// CROSSWIRE — Shared TypeScript Types
// Language definitions are centralized in lib/languages.ts (canonical registry).
// Re-exported here for backward compatibility.
export type { Language } from './languages';
export { SUPPORTED_LANGUAGES, getLanguageByCode } from './languages';


export type AdmissionMode = 'approval_required' | 'auto_approve';

// Database row types
export type Room = {
  id: string;
  code: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  participant_count: number;
  creator_id?: string | null;
  max_capacity: number;
  admission_mode: AdmissionMode;
  host_name?: string;
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

export type JoinRequestStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

export type JoinRequest = {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  language_code: string;
  language_name: string;
  status: JoinRequestStatus;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
};

export type MessageTranslation = {
  id: string;
  message_id: string;
  room_id: string;
  target_language: string;
  target_language_name: string;
  translated_text: string | null;
  translation_status: 'pending' | 'translated' | 'failed';
  created_at: string;
  updated_at?: string;
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
  translations?: Record<string, {
    translated_text: string;
    target_language_name: string;
    translation_status: 'pending' | 'translated' | 'failed';
  }>;
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

// Super Admin & Platform Control Types
export type UserRole = 'user' | 'room_creator' | 'moderator' | 'admin' | 'superadmin';
export type UserStatus = 'active' | 'suspended' | 'banned';

export type UserProfile = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string | null;
  room_count?: number;
  message_count?: number;
};

export type ModerationReport = {
  id: string;
  reporter_id: string | null;
  reporter_name: string | null;
  target_type: 'room' | 'user' | 'message';
  target_id: string;
  reason: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  reviewed_by: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminAuditLog = {
  id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  target_entity: string;
  target_id: string;
  details: Record<string, unknown>;
  ip_address?: string | null;
  created_at: string;
};

export type PlatformSetting = {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
};

