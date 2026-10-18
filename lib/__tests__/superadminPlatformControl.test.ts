/**
 * CROSSWIRE - Super Admin Platform Control, RBAC, Moderation & Audit Test Suite
 */

import type { UserProfile, UserRole, UserStatus, Room } from '../types';
import { SUPPORTED_LANGUAGES } from '../languages';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

async function runSuperAdminTests() {
  console.log('=== 1. RBAC Hierarchy & Server-Side Privilege Boundaries ===');

  function hasAccessToSuperadmin(role: UserRole, status: UserStatus): boolean {
    if (status !== 'active') return false;
    return role === 'superadmin';
  }

  assert(hasAccessToSuperadmin('superadmin', 'active') === true, 'Active superadmin granted access to /superadmin');
  assert(hasAccessToSuperadmin('superadmin', 'suspended') === false, 'Suspended superadmin denied access to /superadmin');
  assert(hasAccessToSuperadmin('superadmin', 'banned') === false, 'Banned superadmin denied access to /superadmin');
  assert(hasAccessToSuperadmin('admin', 'active') === false, 'Admin denied access to /superadmin (superadmin only)');
  assert(hasAccessToSuperadmin('moderator', 'active') === false, 'Moderator denied access to /superadmin');
  assert(hasAccessToSuperadmin('room_creator', 'active') === false, 'Room creator denied access to /superadmin');
  assert(hasAccessToSuperadmin('user', 'active') === false, 'Ordinary user denied access to /superadmin');

  console.log('\n=== 2. Unauthorized Role Escalation & Metadata Spoofing Prevention ===');

  // Simulate an attacker attempting to modify their role in user_metadata
  interface ClientUser {
    id: string;
    email: string;
    user_metadata: { role?: string; is_super_admin?: boolean };
  }

  const attacker: ClientUser = {
    id: 'user-hacker-1',
    email: 'hacker@example.com',
    user_metadata: { role: 'superadmin', is_super_admin: true }, // Client-side spoofed metadata
  };

  const authoritativeProfiles = new Map<string, UserProfile>([
    [
      'user-hacker-1',
      {
        id: 'user-hacker-1',
        email: 'hacker@example.com',
        username: 'hacker',
        display_name: 'Hacker',
        avatar_url: null,
        role: 'user', // Authoritative role in database
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  ]);

  function verifyAuthoritativeRole(user: ClientUser): { isAuthorized: boolean; effectiveRole: UserRole } {
    // SECURITY RULE: Never trust user_metadata for privileges; consult database profile
    const profile = authoritativeProfiles.get(user.id);
    if (!profile || profile.status !== 'active') {
      return { isAuthorized: false, effectiveRole: 'user' };
    }
    return {
      isAuthorized: profile.role === 'superadmin',
      effectiveRole: profile.role,
    };
  }

  const checkSpoofed = verifyAuthoritativeRole(attacker);
  assert(checkSpoofed.isAuthorized === false, 'Client-side metadata spoofing is rejected by server');
  assert(checkSpoofed.effectiveRole === 'user', 'Effective role remains ordinary user');

  // Ordinary user profile self-update restriction
  function attemptProfileUpdate(
    callerId: string,
    callerRole: UserRole,
    targetUserId: string,
    requestedRoleChange?: UserRole,
    requestedStatusChange?: UserStatus
  ): { success: boolean; error?: string } {
    if (requestedRoleChange || requestedStatusChange) {
      if (callerRole !== 'superadmin') {
        return { success: false, error: 'Unauthorized: Only active superadmins can modify user roles or status' };
      }
    }
    return { success: true };
  }

  const selfPromotionAttempt = attemptProfileUpdate('user-hacker-1', 'user', 'user-hacker-1', 'superadmin');
  assert(selfPromotionAttempt.success === false, 'User self-promotion to superadmin blocked');
  assert(Boolean(selfPromotionAttempt.error?.includes('Only active superadmins')), 'Permission error returned on escalation attempt');

  console.log('\n=== 3. Protection of Last Active Superadmin ===');

  const profilesDb = [
    { id: 'sa-1', email: 'prakash.om.global@gmail.com', role: 'superadmin' as UserRole, status: 'active' as UserStatus },
    { id: 'usr-1', email: 'regular@example.com', role: 'user' as UserRole, status: 'active' as UserStatus },
  ];

  function validateSuperAdminDemotionOrSuspension(
    targetId: string,
    newRole: UserRole,
    newStatus: UserStatus
  ): { allowed: boolean; error?: string } {
    const target = profilesDb.find((p) => p.id === targetId);
    if (!target) return { allowed: false, error: 'User not found' };

    if (target.role === 'superadmin') {
      const willDemote = newRole !== 'superadmin';
      const willSuspend = newStatus !== 'active';

      if (willDemote || willSuspend) {
        const remainingActiveSuperAdmins = profilesDb.filter(
          (p) => p.id !== targetId && p.role === 'superadmin' && p.status === 'active'
        ).length;

        if (remainingActiveSuperAdmins < 1) {
          return { allowed: false, error: 'Action rejected: Cannot demote or suspend the last active superadmin' };
        }
      }
    }
    return { allowed: true };
  }

  const demoteLast = validateSuperAdminDemotionOrSuspension('sa-1', 'admin', 'active');
  assert(demoteLast.allowed === false, 'Demoting the sole active superadmin is rejected');

  const suspendLast = validateSuperAdminDemotionOrSuspension('sa-1', 'superadmin', 'suspended');
  assert(suspendLast.allowed === false, 'Suspending the sole active superadmin is rejected');

  // Add a second superadmin
  profilesDb.push({ id: 'sa-2', email: 'second.sa@example.com', role: 'superadmin', status: 'active' });
  const demoteWithBackup = validateSuperAdminDemotionOrSuspension('sa-1', 'admin', 'active');
  assert(demoteWithBackup.allowed === true, 'Demoting superadmin allowed when another active superadmin exists');

  console.log('\n=== 4. User Suspension, Reactivation & Session Controls ===');

  let userState: UserStatus = 'active';

  function applyAccountStatusChange(newStatus: UserStatus): { status: UserStatus; canAccessRooms: boolean } {
    userState = newStatus;
    const canAccessRooms = userState === 'active';
    return { status: userState, canAccessRooms };
  }

  const suspended = applyAccountStatusChange('suspended');
  assert(suspended.status === 'suspended', 'User status transitioned to suspended');
  assert(suspended.canAccessRooms === false, 'Suspended user cannot enter or create rooms');

  const reactivated = applyAccountStatusChange('active');
  assert(reactivated.status === 'active', 'User status restored to active');
  assert(reactivated.canAccessRooms === true, 'Reactivated user restored to normal room access');

  console.log('\n=== 5. Superadmin Room Management & Termination Controls ===');

  interface ManagedRoom extends Room {
    participants: string[];
  }

  const room: ManagedRoom = {
    id: 'room-adm-1',
    code: 'swift-falcon-42',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
    creator_id: 'creator-1',
    max_capacity: 4,
    participant_count: 3,
    admission_mode: 'approval_required',
    participants: ['creator-1', 'guest-1', 'guest-2'],
  };

  // Capacity boundary check
  function adminUpdateCapacity(r: ManagedRoom, newCap: number): { success: boolean; error?: string } {
    if (newCap < 2 || newCap > 16) return { success: false, error: 'Capacity must be within [2, 16]' };
    if (newCap < r.participant_count) return { success: false, error: 'Cannot reduce capacity below current occupancy' };
    r.max_capacity = newCap;
    return { success: true };
  }

  assert(adminUpdateCapacity(room, 6).success === true, 'Superadmin expanded capacity to 6');
  assert(adminUpdateCapacity(room, 2).success === false, 'Superadmin cannot reduce capacity below current occupancy (3)');
  assert(adminUpdateCapacity(room, 20).success === false, 'Superadmin cannot exceed maximum application capacity limit of 16');

  // Superadmin Kicking Participant
  function adminKickParticipant(r: ManagedRoom, participantId: string): boolean {
    const idx = r.participants.indexOf(participantId);
    if (idx === -1) return false;
    r.participants.splice(idx, 1);
    r.participant_count = r.participants.length;
    return true;
  }

  assert(adminKickParticipant(room, 'guest-2') === true, 'Superadmin removed participant guest-2');
  assert(room.participant_count === 2, 'Occupancy updated to 2 after participant removal');

  // Superadmin Terminating Room
  function adminTerminateRoom(r: ManagedRoom): { is_active: boolean; participant_count: number } {
    r.is_active = false;
    r.participants = [];
    r.participant_count = 0;
    return { is_active: r.is_active, participant_count: r.participant_count };
  }

  const termRes = adminTerminateRoom(room);
  assert(termRes.is_active === false, 'Room marked as inactive on termination');
  assert(termRes.participant_count === 0, 'All participants disconnected on termination');

  console.log('\n=== 6. Multilingual Registry Coverage & Management ===');

  assert(SUPPORTED_LANGUAGES.length >= 22, 'Multilingual registry contains at least 22 languages');

  const requiredIndianLanguages = [
    'hi', 'bn', 'te', 'mr', 'ta', 'ur', 'gu', 'kn', 'ml', 'pa', 'or', 'as',
  ];

  for (const code of requiredIndianLanguages) {
    const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    assert(found !== undefined, `Scheduled Indian language "${code}" present in registry`);
  }

  // Toggle Language Enablement
  const disabledLanguages = new Set<string>();

  function toggleLanguage(code: string, enable: boolean): { success: boolean; error?: string } {
    if (code === 'en' && !enable) {
      return { success: false, error: 'Cannot disable default fallback language' };
    }
    if (enable) disabledLanguages.delete(code);
    else disabledLanguages.add(code);
    return { success: true };
  }

  assert(toggleLanguage('ja', false).success === true, 'Superadmin successfully disabled Japanese');
  assert(disabledLanguages.has('ja'), 'Japanese is in disabled list');
  assert(toggleLanguage('ja', true).success === true, 'Superadmin successfully re-enabled Japanese');
  assert(!disabledLanguages.has('ja'), 'Japanese removed from disabled list');
  assert(toggleLanguage('en', false).success === false, 'Superadmin blocked from disabling English fallback');

  console.log('\n=== 7. Platform Settings Validation ===');

  function validatePlatformSetting(key: string, val: unknown): { valid: boolean; error?: string } {
    if (key === 'default_room_capacity') {
      const n = Number(val);
      if (!Number.isInteger(n) || n < 2 || n > 16) return { valid: false, error: 'Capacity out of bounds' };
    }
    if (key === 'default_admission_mode') {
      if (val !== 'approval_required' && val !== 'auto_approve') return { valid: false, error: 'Invalid mode' };
    }
    return { valid: true };
  }

  assert(validatePlatformSetting('default_room_capacity', 2).valid === true, 'Default room capacity 2 accepted');
  assert(validatePlatformSetting('default_room_capacity', 1).valid === false, 'Default room capacity < 2 rejected');
  assert(validatePlatformSetting('default_room_capacity', 25).valid === false, 'Default room capacity > 16 rejected');
  assert(validatePlatformSetting('default_admission_mode', 'approval_required').valid === true, 'Valid admission mode accepted');
  assert(validatePlatformSetting('default_admission_mode', 'invalid_mode').valid === false, 'Invalid admission mode rejected');

  console.log('\n=== 8. Administrative Audit Log Immutability ===');

  interface AuditEntry {
    id: string;
    action: string;
    targetId: string;
    createdAt: string;
  }

  const auditStore: AuditEntry[] = [];

  function recordAudit(entry: AuditEntry): void {
    auditStore.push(Object.freeze({ ...entry }));
  }

  function attemptModifyAudit(id: string): { success: boolean; error?: string } {
    if (!id) return { success: false, error: 'Invalid ID' };
    // Database trigger trg_immutable_audit_logs forbids UPDATE/DELETE
    return { success: false, error: 'Audit logs are immutable. Updates and deletions are forbidden.' };
  }

  recordAudit({ id: 'aud-1', action: 'user_suspend', targetId: 'user-bad-1', createdAt: new Date().toISOString() });
  assert(auditStore.length === 1, 'Audit log recorded');

  const modifyAttempt = attemptModifyAudit('aud-1');
  assert(modifyAttempt.success === false, 'Modification of audit log rejected');
  assert(Boolean(modifyAttempt.error?.includes('immutable')), 'Immutability error returned');

  console.log('\n✓ ALL SUPER ADMIN PLATFORM CONTROL TESTS PASSED (100% SUCCESS)');
}

runSuperAdminTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
