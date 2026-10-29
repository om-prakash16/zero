import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

/**
 * Returns a persistent, valid RFC 4122 UUID for guest users.
 * Automatically clears and migrates any legacy non-UUID formats (e.g. 'guest-abc123')
 * to ensure Postgres UUID columns (rooms.creator_id, participants.user_id) never throw 22P02.
 */
export function getPersistentGuestUid(): string {
  if (typeof window === 'undefined') {
    return uuidv4();
  }

  try {
    const existing = localStorage.getItem('crosswire_guest_uid');
    if (existing && uuidValidate(existing)) {
      return existing;
    }

    let freshUid = '';
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try {
        freshUid = crypto.randomUUID();
      } catch {
        freshUid = uuidv4();
      }
    } else {
      freshUid = uuidv4();
    }

    localStorage.setItem('crosswire_guest_uid', freshUid);
    return freshUid;
  } catch {
    return uuidv4();
  }
}
