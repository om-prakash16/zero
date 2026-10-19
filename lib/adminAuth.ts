import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import type { UserProfile } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';

// Singleton service role client for privileged backend operations
let cachedAdminClient: SupabaseClient | null = null;

export function getAdminSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('Supabase admin credentials missing (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY)');
  }
  if (!cachedAdminClient) {
    cachedAdminClient = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cachedAdminClient;
}

export type AuthResult =
  | { authorized: true; user: User; profile: UserProfile; client: SupabaseClient }
  | { authorized: false; status: number; error: string };

/**
 * Extracts client IP safely from standard proxy headers
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/**
 * Strict server-side verification of Super Admin privileges.
 * Validates JWT token signature and queries public.profiles table.
 * Rejects client-side metadata spoofing.
 */
export async function verifySuperAdmin(
  request: Request,
  options?: { allowAdmin?: boolean }
): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        authorized: false,
        status: 401,
        error: 'Unauthorized: Missing or malformed authorization token',
      };
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return {
        authorized: false,
        status: 401,
        error: 'Unauthorized: Empty token',
      };
    }

    const adminClient = getAdminSupabaseClient();

    // 1. Validate JWT with Supabase Auth
    const {
      data: { user },
      error: authErr,
    } = await adminClient.auth.getUser(token);

    if (authErr || !user) {
      return {
        authorized: false,
        status: 401,
        error: 'Unauthorized: Session is invalid or has expired',
      };
    }

    // 2. Query authoritative public.profiles table
    const { data: profile, error: profErr } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const userEmail = (user.email || profile?.email || '').toLowerCase();
    const isBootstrapSuperAdmin = userEmail === 'prakash.om.global@gmail.com';

    // Auto-bootstrap profile if missing for authorized bootstrap email
    if ((profErr || !profile) && isBootstrapSuperAdmin) {
      const { data: newProf, error: createErr } = await adminClient
        .from('profiles')
        .insert({
          id: user.id,
          email: userEmail,
          display_name: user.user_metadata?.full_name || 'Super Admin',
          role: 'superadmin',
          status: 'active',
        })
        .select()
        .single();

      if (createErr || !newProf) {
        return {
          authorized: false,
          status: 500,
          error: 'Failed to bootstrap superadmin profile',
        };
      }

      return {
        authorized: true,
        user,
        profile: newProf as UserProfile,
        client: adminClient,
      };
    }

    if (!profile) {
      return {
        authorized: false,
        status: 403,
        error: 'Forbidden: Profile not found. Superadmin access denied.',
      };
    }

    // 3. Ensure role is strictly superadmin and status is active
    if (profile.status !== 'active') {
      return {
        authorized: false,
        status: 403,
        error: `Forbidden: Account is ${profile.status}`,
      };
    }

    const isSuperAdmin = profile.role === 'superadmin' || isBootstrapSuperAdmin;
    const isAdmin = profile.role === 'admin';
    const allowAdmin = options?.allowAdmin ?? false;

    if (!isSuperAdmin && (!allowAdmin || !isAdmin)) {
      return {
        authorized: false,
        status: 403,
        error: allowAdmin
          ? 'Forbidden: Superadmin or Admin privileges required to access this resource'
          : 'Forbidden: Superadmin privileges required to perform this action',
      };
    }

    return {
      authorized: true,
      user,
      profile: profile as UserProfile,
      client: adminClient,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Authentication verification failed';
    return {
      authorized: false,
      status: 500,
      error: `Internal auth error: ${msg}`,
    };
  }
}

/**
 * Inserts immutable record into admin_audit_logs
 */
export async function logAdminAction(params: {
  adminId: string;
  adminEmail: string;
  action: string;
  targetEntity: string;
  targetId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    const adminClient = getAdminSupabaseClient();
    await adminClient.from('admin_audit_logs').insert({
      admin_id: params.adminId,
      admin_email: params.adminEmail,
      action: params.action,
      target_entity: params.targetEntity,
      target_id: params.targetId,
      details: params.details || {},
      ip_address: params.ipAddress || null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Log error to console without breaking client response
    console.error('Failed to write admin audit log:', err);
  }
}
