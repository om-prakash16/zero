// CROSSWIRE — Canonical Multilingual Language Registry
// Single source of truth for all language definitions, categories, capabilities, and variants.
// Every component, API route, and test imports from this file.

// ─── Core Types ─────────────────────────────────────────────────────────────

export type TextDirection = 'ltr' | 'rtl';

export type CapabilityLevel = 'supported' | 'partial' | 'unsupported' | 'unknown';

export type LanguageCapabilities = {
  /** Can Gemini translate this language? */
  translation: CapabilityLevel;
  /** Does the Web Speech API typically recognize this language? */
  speechRecognition: CapabilityLevel;
  /** Does the Web Speech API typically synthesize this language? */
  speechSynthesis: CapabilityLevel;
};

export type LanguageCategory =
  | 'indian-scheduled'
  | 'indian-regional'
  | 'global'
  | 'european'
  | 'asian'
  | 'african';

export type LanguageEntry = {
  /** Canonical unique identifier (BCP-47 base or extended subtag). */
  code: string;
  /** English display name. */
  name: string;
  /** Native-script display name. */
  nativeName: string;
  /** BCP-47 tag for Web Speech API (recognition + synthesis). */
  speechCode: string;
  /** Text direction. */
  dir: TextDirection;
  /** Primary category for grouping in the selector. */
  category: LanguageCategory;
  /** Provider capabilities (Gemini translation, browser speech). */
  capabilities: LanguageCapabilities;
  /** Script label for variants (e.g. "Simplified", "Cyrillic"). */
  script?: string;
  /** Region label for variants (e.g. "India", "Brazil"). */
  region?: string;
  /** If this is a variant, points to the parent language code. */
  variantOf?: string;
};

// ─── Capability Presets ─────────────────────────────────────────────────────

const FULL: LanguageCapabilities = {
  translation: 'supported',
  speechRecognition: 'supported',
  speechSynthesis: 'supported',
};

const TRANSLATE_SPEECH_REC: LanguageCapabilities = {
  translation: 'supported',
  speechRecognition: 'supported',
  speechSynthesis: 'partial',
};

const TRANSLATE_SYNTH: LanguageCapabilities = {
  translation: 'supported',
  speechRecognition: 'partial',
  speechSynthesis: 'supported',
};

const TRANSLATE_ONLY: LanguageCapabilities = {
  translation: 'supported',
  speechRecognition: 'unsupported',
  speechSynthesis: 'unsupported',
};

const TRANSLATE_PARTIAL_SPEECH: LanguageCapabilities = {
  translation: 'supported',
  speechRecognition: 'partial',
  speechSynthesis: 'partial',
};

const PARTIAL_ALL: LanguageCapabilities = {
  translation: 'partial',
  speechRecognition: 'unsupported',
  speechSynthesis: 'unsupported',
};

// ─── Complete Language Registry ─────────────────────────────────────────────

export const LANGUAGE_REGISTRY: LanguageEntry[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 22 Constitutionally Scheduled Indian Languages (Eighth Schedule)
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', speechCode: 'as-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: TRANSLATE_ONLY },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', speechCode: 'bn-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: TRANSLATE_SPEECH_REC },
  { code: 'brx', name: 'Bodo', nativeName: 'बड़ो', speechCode: 'brx-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: PARTIAL_ALL },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी', speechCode: 'doi-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: PARTIAL_ALL },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', speechCode: 'gu-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: TRANSLATE_SPEECH_REC },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', speechCode: 'hi-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: FULL },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', speechCode: 'kn-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: TRANSLATE_SPEECH_REC },
  { code: 'ks', name: 'Kashmiri', nativeName: 'کٲشُر', speechCode: 'ks-IN', dir: 'rtl', category: 'indian-scheduled', capabilities: PARTIAL_ALL },
  { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी', speechCode: 'kok-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: PARTIAL_ALL },
  { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', speechCode: 'mai-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: PARTIAL_ALL },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', speechCode: 'ml-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: TRANSLATE_SPEECH_REC },
  { code: 'mni', name: 'Manipuri (Meitei)', nativeName: 'ꯃꯩꯇꯩꯂꯣꯟ', speechCode: 'mni-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: PARTIAL_ALL },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', speechCode: 'mr-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: TRANSLATE_SPEECH_REC },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', speechCode: 'ne-NP', dir: 'ltr', category: 'indian-scheduled', capabilities: TRANSLATE_ONLY },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', speechCode: 'or-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: TRANSLATE_ONLY },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', speechCode: 'pa-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: TRANSLATE_SPEECH_REC },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', speechCode: 'sa-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: PARTIAL_ALL },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', speechCode: 'sat-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: PARTIAL_ALL },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي', speechCode: 'sd-IN', dir: 'rtl', category: 'indian-scheduled', capabilities: TRANSLATE_ONLY },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', speechCode: 'ta-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: FULL },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', speechCode: 'te-IN', dir: 'ltr', category: 'indian-scheduled', capabilities: TRANSLATE_SPEECH_REC },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', speechCode: 'ur-PK', dir: 'rtl', category: 'indian-scheduled', capabilities: TRANSLATE_SPEECH_REC },

  // ═══════════════════════════════════════════════════════════════════════════
  // Additional Indian Regional Languages
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'bho', name: 'Bhojpuri', nativeName: 'भोजपुरी', speechCode: 'bho-IN', dir: 'ltr', category: 'indian-regional', capabilities: PARTIAL_ALL },
  { code: 'raj', name: 'Rajasthani', nativeName: 'राजस्थानी', speechCode: 'raj-IN', dir: 'ltr', category: 'indian-regional', capabilities: PARTIAL_ALL },
  { code: 'tcy', name: 'Tulu', nativeName: 'ತುಳು', speechCode: 'tcy-IN', dir: 'ltr', category: 'indian-regional', capabilities: PARTIAL_ALL },
  { code: 'hne', name: 'Chhattisgarhi', nativeName: 'छत्तीसगढ़ी', speechCode: 'hne-IN', dir: 'ltr', category: 'indian-regional', capabilities: PARTIAL_ALL },
  { code: 'mag', name: 'Magahi', nativeName: 'मगही', speechCode: 'mag-IN', dir: 'ltr', category: 'indian-regional', capabilities: PARTIAL_ALL },
  { code: 'gbm', name: 'Garhwali', nativeName: 'गढ़वळि', speechCode: 'gbm-IN', dir: 'ltr', category: 'indian-regional', capabilities: PARTIAL_ALL },
  { code: 'kfy', name: 'Kumaoni', nativeName: 'कुमाऊँनी', speechCode: 'kfy-IN', dir: 'ltr', category: 'indian-regional', capabilities: PARTIAL_ALL },
  { code: 'lus', name: 'Mizo', nativeName: 'Mizo ṭawng', speechCode: 'lus-IN', dir: 'ltr', category: 'indian-regional', capabilities: PARTIAL_ALL },
  { code: 'kha', name: 'Khasi', nativeName: 'Ka Ktien Khasi', speechCode: 'kha-IN', dir: 'ltr', category: 'indian-regional', capabilities: PARTIAL_ALL },
  { code: 'trp', name: 'Kokborok', nativeName: 'Kókborok', speechCode: 'trp-IN', dir: 'ltr', category: 'indian-regional', capabilities: PARTIAL_ALL },

  // ═══════════════════════════════════════════════════════════════════════════
  // Major Global Languages
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'en', name: 'English', nativeName: 'English', speechCode: 'en-US', dir: 'ltr', category: 'global', capabilities: FULL },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', speechCode: 'zh-CN', dir: 'ltr', category: 'global', capabilities: FULL, script: 'Simplified' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', speechCode: 'es-ES', dir: 'ltr', category: 'global', capabilities: FULL },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', speechCode: 'ar-SA', dir: 'rtl', category: 'global', capabilities: FULL },
  { code: 'fr', name: 'French', nativeName: 'Français', speechCode: 'fr-FR', dir: 'ltr', category: 'global', capabilities: FULL },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', speechCode: 'pt-BR', dir: 'ltr', category: 'global', capabilities: FULL, region: 'Brazil' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', speechCode: 'ru-RU', dir: 'ltr', category: 'global', capabilities: FULL },
  { code: 'de', name: 'German', nativeName: 'Deutsch', speechCode: 'de-DE', dir: 'ltr', category: 'global', capabilities: FULL },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', speechCode: 'ja-JP', dir: 'ltr', category: 'global', capabilities: FULL },
  { code: 'ko', name: 'Korean', nativeName: '한국어', speechCode: 'ko-KR', dir: 'ltr', category: 'global', capabilities: FULL },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', speechCode: 'id-ID', dir: 'ltr', category: 'global', capabilities: FULL },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', speechCode: 'vi-VN', dir: 'ltr', category: 'global', capabilities: TRANSLATE_SPEECH_REC },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', speechCode: 'tr-TR', dir: 'ltr', category: 'global', capabilities: FULL },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', speechCode: 'it-IT', dir: 'ltr', category: 'global', capabilities: FULL },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', speechCode: 'th-TH', dir: 'ltr', category: 'global', capabilities: FULL },
  { code: 'fil', name: 'Filipino (Tagalog)', nativeName: 'Filipino', speechCode: 'fil-PH', dir: 'ltr', category: 'global', capabilities: TRANSLATE_SPEECH_REC },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', speechCode: 'ms-MY', dir: 'ltr', category: 'global', capabilities: TRANSLATE_SPEECH_REC },
  { code: 'fa', name: 'Persian (Farsi)', nativeName: 'فارسی', speechCode: 'fa-IR', dir: 'rtl', category: 'global', capabilities: TRANSLATE_SYNTH },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', speechCode: 'nl-NL', dir: 'ltr', category: 'global', capabilities: FULL },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', speechCode: 'pl-PL', dir: 'ltr', category: 'global', capabilities: FULL },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', speechCode: 'uk-UA', dir: 'ltr', category: 'global', capabilities: TRANSLATE_SPEECH_REC },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', speechCode: 'sw-KE', dir: 'ltr', category: 'global', capabilities: TRANSLATE_ONLY },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', speechCode: 'he-IL', dir: 'rtl', category: 'global', capabilities: FULL },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', speechCode: 'el-GR', dir: 'ltr', category: 'global', capabilities: FULL },

  // ═══════════════════════════════════════════════════════════════════════════
  // Regional / Script Variants
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English', speechCode: 'en-GB', dir: 'ltr', category: 'global', capabilities: FULL, region: 'UK', variantOf: 'en' },
  { code: 'en-IN', name: 'English (India)', nativeName: 'English', speechCode: 'en-IN', dir: 'ltr', category: 'global', capabilities: FULL, region: 'India', variantOf: 'en' },
  { code: 'en-AU', name: 'English (Australia)', nativeName: 'English', speechCode: 'en-AU', dir: 'ltr', category: 'global', capabilities: FULL, region: 'Australia', variantOf: 'en' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', speechCode: 'zh-TW', dir: 'ltr', category: 'global', capabilities: FULL, script: 'Traditional', variantOf: 'zh' },
  { code: 'es-419', name: 'Spanish (Latin America)', nativeName: 'Español', speechCode: 'es-419', dir: 'ltr', category: 'global', capabilities: FULL, region: 'Latin America', variantOf: 'es' },
  { code: 'fr-CA', name: 'French (Canada)', nativeName: 'Français', speechCode: 'fr-CA', dir: 'ltr', category: 'global', capabilities: FULL, region: 'Canada', variantOf: 'fr' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)', nativeName: 'Português', speechCode: 'pt-PT', dir: 'ltr', category: 'global', capabilities: FULL, region: 'Portugal', variantOf: 'pt' },
  { code: 'de-AT', name: 'German (Austria)', nativeName: 'Deutsch', speechCode: 'de-AT', dir: 'ltr', category: 'european', capabilities: FULL, region: 'Austria', variantOf: 'de' },
  { code: 'nl-BE', name: 'Dutch (Belgium)', nativeName: 'Nederlands', speechCode: 'nl-BE', dir: 'ltr', category: 'european', capabilities: FULL, region: 'Belgium', variantOf: 'nl' },
  { code: 'sr-Cyrl', name: 'Serbian (Cyrillic)', nativeName: 'Српски', speechCode: 'sr-RS', dir: 'ltr', category: 'european', capabilities: TRANSLATE_PARTIAL_SPEECH, script: 'Cyrillic', variantOf: 'sr' },
  { code: 'sr-Latn', name: 'Serbian (Latin)', nativeName: 'Srpski', speechCode: 'sr-Latn-RS', dir: 'ltr', category: 'european', capabilities: TRANSLATE_PARTIAL_SPEECH, script: 'Latin', variantOf: 'sr' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Additional European Languages
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'ro', name: 'Romanian', nativeName: 'Română', speechCode: 'ro-RO', dir: 'ltr', category: 'european', capabilities: FULL },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', speechCode: 'cs-CZ', dir: 'ltr', category: 'european', capabilities: FULL },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', speechCode: 'sk-SK', dir: 'ltr', category: 'european', capabilities: FULL },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', speechCode: 'hu-HU', dir: 'ltr', category: 'european', capabilities: FULL },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', speechCode: 'sv-SE', dir: 'ltr', category: 'european', capabilities: FULL },
  { code: 'nb', name: 'Norwegian Bokmål', nativeName: 'Norsk bokmål', speechCode: 'nb-NO', dir: 'ltr', category: 'european', capabilities: FULL },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', speechCode: 'da-DK', dir: 'ltr', category: 'european', capabilities: FULL },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', speechCode: 'fi-FI', dir: 'ltr', category: 'european', capabilities: FULL },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', speechCode: 'hr-HR', dir: 'ltr', category: 'european', capabilities: TRANSLATE_PARTIAL_SPEECH },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски / Srpski', speechCode: 'sr-RS', dir: 'ltr', category: 'european', capabilities: TRANSLATE_PARTIAL_SPEECH },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', speechCode: 'bg-BG', dir: 'ltr', category: 'european', capabilities: TRANSLATE_SPEECH_REC },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', speechCode: 'sl-SI', dir: 'ltr', category: 'european', capabilities: TRANSLATE_PARTIAL_SPEECH },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', speechCode: 'lt-LT', dir: 'ltr', category: 'european', capabilities: TRANSLATE_PARTIAL_SPEECH },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', speechCode: 'lv-LV', dir: 'ltr', category: 'european', capabilities: TRANSLATE_PARTIAL_SPEECH },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti', speechCode: 'et-EE', dir: 'ltr', category: 'european', capabilities: TRANSLATE_PARTIAL_SPEECH },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip', speechCode: 'sq-AL', dir: 'ltr', category: 'european', capabilities: TRANSLATE_ONLY },
  { code: 'bs', name: 'Bosnian', nativeName: 'Bosanski', speechCode: 'bs-BA', dir: 'ltr', category: 'european', capabilities: TRANSLATE_ONLY },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska', speechCode: 'is-IS', dir: 'ltr', category: 'european', capabilities: TRANSLATE_ONLY },
  { code: 'ga', name: 'Irish', nativeName: 'Gaeilge', speechCode: 'ga-IE', dir: 'ltr', category: 'european', capabilities: TRANSLATE_ONLY },
  { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg', speechCode: 'cy-GB', dir: 'ltr', category: 'european', capabilities: TRANSLATE_ONLY },
  { code: 'ca', name: 'Catalan', nativeName: 'Català', speechCode: 'ca-ES', dir: 'ltr', category: 'european', capabilities: TRANSLATE_SPEECH_REC },
  { code: 'eu', name: 'Basque', nativeName: 'Euskara', speechCode: 'eu-ES', dir: 'ltr', category: 'european', capabilities: TRANSLATE_ONLY },
  { code: 'gl', name: 'Galician', nativeName: 'Galego', speechCode: 'gl-ES', dir: 'ltr', category: 'european', capabilities: TRANSLATE_ONLY },

  // ═══════════════════════════════════════════════════════════════════════════
  // Additional Asian Languages
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာ', speechCode: 'my-MM', dir: 'ltr', category: 'asian', capabilities: TRANSLATE_ONLY },
  { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ', speechCode: 'km-KH', dir: 'ltr', category: 'asian', capabilities: TRANSLATE_ONLY },
  { code: 'lo', name: 'Lao', nativeName: 'ລາວ', speechCode: 'lo-LA', dir: 'ltr', category: 'asian', capabilities: TRANSLATE_ONLY },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол', speechCode: 'mn-MN', dir: 'ltr', category: 'asian', capabilities: TRANSLATE_ONLY },

  // ═══════════════════════════════════════════════════════════════════════════
  // African Languages
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', speechCode: 'am-ET', dir: 'ltr', category: 'african', capabilities: TRANSLATE_ONLY },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa', speechCode: 'ha-NG', dir: 'ltr', category: 'african', capabilities: TRANSLATE_ONLY },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', speechCode: 'yo-NG', dir: 'ltr', category: 'african', capabilities: TRANSLATE_ONLY },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo', speechCode: 'ig-NG', dir: 'ltr', category: 'african', capabilities: TRANSLATE_ONLY },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', speechCode: 'af-ZA', dir: 'ltr', category: 'african', capabilities: TRANSLATE_SPEECH_REC },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', speechCode: 'zu-ZA', dir: 'ltr', category: 'african', capabilities: TRANSLATE_ONLY },
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa', speechCode: 'xh-ZA', dir: 'ltr', category: 'african', capabilities: TRANSLATE_ONLY },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali', speechCode: 'so-SO', dir: 'ltr', category: 'african', capabilities: TRANSLATE_ONLY },
];

// ─── Lookup Utilities ───────────────────────────────────────────────────────

/** Fast code→entry lookup map (built once at import time). */
const _codeMap = new Map<string, LanguageEntry>();
for (const entry of LANGUAGE_REGISTRY) {
  _codeMap.set(entry.code, entry);
}

/** Default fallback language. */
const FALLBACK_LANG = LANGUAGE_REGISTRY.find((l) => l.code === 'en')!;

/** Get a language entry by code. Falls back to English for unknown codes. */
export function getLanguageEntry(code: string): LanguageEntry {
  return _codeMap.get(code) ?? FALLBACK_LANG;
}

/** Check if a language code exists in the canonical registry. */
export function isLanguageSupported(code: string): boolean {
  return _codeMap.has(code);
}

/** Get all canonical (non-variant) languages. */
export function getCanonicalLanguages(): LanguageEntry[] {
  return LANGUAGE_REGISTRY.filter((l) => !l.variantOf);
}

/** Get languages by category. */
export function getLanguagesByCategory(category: LanguageCategory): LanguageEntry[] {
  return LANGUAGE_REGISTRY.filter((l) => l.category === category);
}

/** Get all 22 Eighth Schedule languages. */
export function getScheduledIndianLanguages(): LanguageEntry[] {
  return getLanguagesByCategory('indian-scheduled');
}

/** Get variants for a given parent language code. */
export function getVariants(parentCode: string): LanguageEntry[] {
  return LANGUAGE_REGISTRY.filter((l) => l.variantOf === parentCode);
}

/** All right-to-left language codes (for UI rendering). */
export function getRtlLanguageCodes(): string[] {
  return LANGUAGE_REGISTRY.filter((l) => l.dir === 'rtl').map((l) => l.code);
}

/** Check if a language code is RTL. */
export function isRtl(code: string): boolean {
  return getLanguageEntry(code).dir === 'rtl';
}

// ─── Category Metadata ──────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<LanguageCategory, string> = {
  'indian-scheduled': 'Indian Languages (Eighth Schedule)',
  'indian-regional': 'Other Indian Regional Languages',
  'global': 'Global Languages',
  'european': 'European Languages',
  'asian': 'Asian Languages',
  'african': 'African Languages',
};

export const CATEGORY_ORDER: LanguageCategory[] = [
  'indian-scheduled',
  'indian-regional',
  'global',
  'european',
  'asian',
  'african',
];

// ─── Search ─────────────────────────────────────────────────────────────────

/** Search languages by English name, native name, or code (Unicode-safe). */
export function searchLanguages(query: string, entries?: LanguageEntry[]): LanguageEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return entries ?? LANGUAGE_REGISTRY;
  const source = entries ?? LANGUAGE_REGISTRY;
  return source.filter(
    (l) =>
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q) ||
      (l.region && l.region.toLowerCase().includes(q)) ||
      (l.script && l.script.toLowerCase().includes(q))
  );
}

// ─── Recently Used (Local Storage) ──────────────────────────────────────────

const RECENT_KEY = 'crosswire_recent_languages';
const MAX_RECENT = 5;

export function getRecentLanguages(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentLanguage(code: string): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = getRecentLanguages().filter((c) => c !== code);
    const next = [code, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

// ─── Backward Compatibility ─────────────────────────────────────────────────
// These re-exports maintain the interface expected by existing components.

export type Language = {
  code: string;
  name: string;
  nativeName: string;
  speechCode: string;
  script?: string;
  region?: string;
  capabilities?: {
    textTranslation?: boolean;
    speechRecognition?: boolean | CapabilityLevel;
    speechSynthesis?: boolean | CapabilityLevel;
    verified?: boolean;
    translation?: CapabilityLevel;
  };
};

/** Backward-compatible flat list. */
export const SUPPORTED_LANGUAGES: Language[] = LANGUAGE_REGISTRY.map((l) => ({
  code: l.code,
  name: l.name,
  nativeName: l.nativeName,
  speechCode: l.speechCode,
}));

/** Backward-compatible lookup. */
export function getLanguageByCode(code: string): Language {
  const entry = getLanguageEntry(code);
  return {
    code: entry.code,
    name: entry.name,
    nativeName: entry.nativeName,
    speechCode: entry.speechCode,
  };
}
