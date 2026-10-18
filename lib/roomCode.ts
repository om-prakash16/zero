// CROSSWIRE Room Code & URL Utilities

const ADJECTIVES = [
  'brave', 'wild', 'bold', 'sharp', 'loud', 'fierce', 'fast', 'dark',
  'cold', 'hot', 'hard', 'iron', 'gold', 'fire', 'storm', 'raw',
];

const NOUNS = [
  'wolf', 'hawk', 'bear', 'fox', 'lion', 'crow', 'bull', 'elk',
  'fang', 'claw', 'blade', 'forge', 'ridge', 'peak', 'vale', 'reef',
];

/**
 * Generate a clean 3-part memorable room code: [adj]-[noun]-[2digit]
 * Example: 'fire-wolf-42'
 */
export function generateRoomCode(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10-99
  return `${adj}-${noun}-${num}`;
}

/**
 * Format a room code for human-friendly display
 * Example: 'fire-wolf-42' -> 'FIRE · WOLF · 42'
 */
export function formatRoomCode(code: string): string {
  if (!code) return '';
  return normalizeRoomCode(code).toUpperCase().replace(/-/g, ' · ');
}

/**
 * Extract and normalize room code from raw input, codes with spaces/bullets, or full URLs
 * Supports:
 * - 'brave-hawk-21' -> 'brave-hawk-21'
 * - 'BRAVE · HAWK · 21' -> 'brave-hawk-21'
 * - 'http://localhost:3000/room/brave-hawk-21' -> 'brave-hawk-21'
 * - 'https://crosswire.app/room/brave-hawk-21?ref=invite' -> 'brave-hawk-21'
 */
export function normalizeRoomCode(input: string): string {
  if (!input) return '';
  let cleaned = input.trim();

  // Strip query parameters and hash fragments
  cleaned = cleaned.split('?')[0].split('#')[0];

  // If input is a URL or contains path segments
  if (cleaned.includes('/room/')) {
    const parts = cleaned.split('/room/');
    cleaned = parts[parts.length - 1];
  } else if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    cleaned = parts[parts.length - 1];
  }

  return cleaned
    .toLowerCase()
    .replace(/[·•\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Validate that a normalized code adheres to the standard format
 */
export function isValidRoomCode(input: string): boolean {
  const normalized = normalizeRoomCode(input);
  return /^[a-z]+-[a-z]+-\d{2}$/.test(normalized);
}

/**
 * Helper to construct an absolute shareable invitation link
 */
export function getRoomInviteUrl(code: string, origin?: string): string {
  const normalized = normalizeRoomCode(code);
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return `${base}/room/${normalized}`;
}
