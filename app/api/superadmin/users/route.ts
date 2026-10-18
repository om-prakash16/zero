import { NextResponse } from 'next/server';
import { verifySuperAdmin, logAdminAction, getClientIp } from '@/lib/adminAuth';
import type { UserRole, UserStatus } from '@/lib/types';

export async function GET(request: Request) {
  const auth = await verifySuperAdmin(request, { allowAdmin: true });
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client } = auth;
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const search = (searchParams.get('search') || '').trim();
  const roleFilter = searchParams.get('role');
  const statusFilter = searchParams.get('status');

  const offset = (page - 1) * limit;

  try {
    let query = client
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%,username.ilike.%${search}%`);
    }

    if (roleFilter && roleFilter !== 'all') {
      query = query.eq('role', roleFilter);
    }

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: users, count, error } = await query;
    if (error) throw error;

    // Fetch counts for user rooms & messages in bulk for current page
    const userIds = (users || []).map((u) => u.id);
    const roomCounts: Record<string, number> = {};
    const messageCounts: Record<string, number> = {};

    if (userIds.length > 0) {
      const [roomsRes, msgsRes] = await Promise.all([
        client.from('rooms').select('creator_id').in('creator_id', userIds),
        client.from('messages').select('sender_id').in('sender_id', userIds),
      ]);

      (roomsRes.data || []).forEach((r) => {
        if (r.creator_id) roomCounts[r.creator_id] = (roomCounts[r.creator_id] || 0) + 1;
      });

      (msgsRes.data || []).forEach((m) => {
        if (m.sender_id) messageCounts[m.sender_id] = (messageCounts[m.sender_id] || 0) + 1;
      });
    }

    const enrichedUsers = (users || []).map((u) => ({
      ...u,
      room_count: roomCounts[u.id] || 0,
      message_count: messageCounts[u.id] || 0,
    }));

    return NextResponse.json({
      success: true,
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query users';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client, user: adminUser } = auth;
  const ipAddress = getClientIp(request);

  let body: {
    userId?: string;
    action?: 'update_role' | 'suspend' | 'reactivate' | 'ban';
    role?: UserRole;
    status?: UserStatus;
    reason?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, action, role, status, reason } = body;
  if (!userId || !action) {
    return NextResponse.json({ error: 'userId and action are required' }, { status: 400 });
  }

  try {
    // 1. Fetch current target user
    const { data: targetUser, error: findErr } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (findErr || !targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // 2. Protect last active superadmin
    if (targetUser.role === 'superadmin') {
      const willDemote = action === 'update_role' && role && role !== 'superadmin';
      const willSuspend = (action === 'suspend' || action === 'ban') || (status && status !== 'active');

      if (willDemote || willSuspend) {
        const { count: superAdminCount, error: countErr } = await client
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'superadmin')
          .eq('status', 'active');

        if (countErr) throw countErr;
        if ((superAdminCount || 0) <= 1) {
          return NextResponse.json(
            { error: 'Cannot demote, suspend, or ban the last active superadmin on the platform' },
            { status: 400 }
          );
        }
      }
    }

    const updates: Partial<{ role: UserRole; status: UserStatus; updated_at: string }> = {
      updated_at: new Date().toISOString(),
    };

    if (action === 'update_role') {
      if (!role || !['user', 'room_creator', 'moderator', 'admin', 'superadmin'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });
      }
      updates.role = role;
    } else if (action === 'suspend') {
      updates.status = 'suspended';
    } else if (action === 'reactivate') {
      updates.status = 'active';
    } else if (action === 'ban') {
      updates.status = 'banned';
    }

    const { data: updated, error: updateErr } = await client
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Log administrative action
    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email || 'superadmin',
      action: `user_${action}`,
      targetEntity: 'user',
      targetId: userId,
      details: {
        previousRole: targetUser.role,
        previousStatus: targetUser.status,
        newRole: updated.role,
        newStatus: updated.status,
        targetEmail: targetUser.email,
        reason: reason || null,
      },
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `User ${action} applied successfully`,
      user: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'User update failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client, user: adminUser } = auth;
  const ipAddress = getClientIp(request);
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const { data: targetUser } = await client.from('profiles').select('*').eq('id', userId).single();
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // Check if target is last superadmin
    if (targetUser.role === 'superadmin') {
      const { count } = await client
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'superadmin')
        .eq('status', 'active');

      if ((count || 0) <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last active superadmin' },
          { status: 400 }
        );
      }
    }

    // Delete user from auth and profiles (cascades)
    const { error: delErr } = await client.auth.admin.deleteUser(userId);
    if (delErr) throw delErr;

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email || 'superadmin',
      action: 'user_delete',
      targetEntity: 'user',
      targetId: userId,
      details: {
        deletedUserEmail: targetUser.email,
        deletedUserRole: targetUser.role,
      },
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'User deletion failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
