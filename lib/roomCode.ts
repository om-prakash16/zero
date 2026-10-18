// Room code generation utility
const ADJECTIVES = [
  'brave', 'wild', 'bold', 'sharp', 'loud', 'fierce', 'fast', 'dark',
  'cold', 'hot', 'hard', 'iron', 'gold', 'fire', 'storm', 'raw',
];

const NOUNS = [
  'wolf', 'hawk', 'bear', 'fox', 'lion', 'crow', 'bull', 'elk',
  'fang', 'claw', 'blade', 'forge', 'ridge', 'peak', 'vale', 'reef',
];

export function generateRoomCode(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10-99
  return `${adj}-${noun}-${num}`;
}

export function formatRoomCode(code: string): string {
  return code.toUpperCase().replace(/-/g, ' · ');
}

export function normalizeRoomCode(code: string): string {
  return code
    .toLowerCase()
    .replace(/[·•\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
