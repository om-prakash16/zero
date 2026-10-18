import { NextResponse } from 'next/server';
import { verifySuperAdmin, logAdminAction, getClientIp } from '@/lib/adminAuth';
import type { AdmissionMode } from '@/lib/types';

export async function GET(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client } = auth;
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const search = (searchParams.get('search') || '').trim();
  const statusFilter = searchParams.get('status'); // 'active', 'closed', 'all'

  const offset = (page - 1) * limit;

  try {
    let query = client
      .from('rooms')
      .select('*, participants(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.ilike('code', `%${search}%`);
    }

    if (statusFilter === 'active') {
      query = query.eq('is_active', true);
    } else if (statusFilter === 'closed') {
      query = query.eq('is_active', false);
    }

    const { data: rooms, count, error } = await query;
    if (error) throw error;

    // Fetch creator profiles and pending request counts
    const creatorIds = Array.from(new Set((rooms || []).map((r) => r.creator_id).filter(Boolean)));
    const roomIds = (rooms || []).map((r) => r.id);

    const creatorMap: Record<string, { email: string; display_name: string }> = {};
    const pendingReqMap: Record<string, number> = {};

    if (creatorIds.length > 0) {
      const { data: creators } = await client
        .from('profiles')
        .select('id, email, display_name')
        .in('id', creatorIds);

      (creators || []).forEach((c) => {
        creatorMap[c.id] = { email: c.email || '', display_name: c.display_name || '' };
      });
    }

    if (roomIds.length > 0) {
      const { data: pendingReqs } = await client
        .from('join_requests')
        .select('room_id')
        .in('room_id', roomIds)
        .eq('status', 'pending');

      (pendingReqs || []).forEach((req) => {
        pendingReqMap[req.room_id] = (pendingReqMap[req.room_id] || 0) + 1;
      });
    }

    const enrichedRooms = (rooms || []).map((r) => ({
      ...r,
      creator: r.creator_id ? creatorMap[r.creator_id] || null : null,
      pending_requests_count: pendingReqMap[r.id] || 0,
    }));

    return NextResponse.json({
      success: true,
      rooms: enrichedRooms,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query rooms';
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
    roomId?: string;
    action?: 'update_capacity' | 'update_admission_mode' | 'close' | 'reopen' | 'remove_participant' | 'terminate';
    maxCapacity?: number;
    admissionMode?: AdmissionMode;
    participantId?: string;
    reason?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { roomId, action, maxCapacity, admissionMode, participantId, reason } = body;
  if (!roomId || !action) {
    return NextResponse.json({ error: 'roomId and action are required' }, { status: 400 });
  }

  try {
    const { data: room, error: roomErr } = await client
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (action === 'update_capacity') {
      if (typeof maxCapacity !== 'number' || maxCapacity < 2 || maxCapacity > 16) {
        return NextResponse.json({ error: 'Capacity must be an integer between 2 and 16' }, { status: 400 });
      }
      if (maxCapacity < room.participant_count) {
        return NextResponse.json(
          { error: `Cannot reduce capacity below current occupant count (${room.participant_count})` },
          { status: 400 }
        );
      }

      const { data: updated, error: uErr } = await client
        .from('rooms')
        .update({ max_capacity: maxCapacity, updated_at: new Date().toISOString() })
        .eq('id', roomId)
        .select()
        .single();

      if (uErr) throw uErr;

      await logAdminAction({
        adminId: adminUser.id,
        adminEmail: adminUser.email || 'superadmin',
        action: 'room_update_capacity',
        targetEntity: 'room',
        targetId: roomId,
        details: { roomCode: room.code, previousCapacity: room.max_capacity, newCapacity: maxCapacity, reason },
        ipAddress,
      });

      return NextResponse.json({ success: true, room: updated });
    }

    if (action === 'update_admission_mode') {
      if (!admissionMode || !['approval_required', 'auto_approve'].includes(admissionMode)) {
        return NextResponse.json({ error: 'Invalid admission mode' }, { status: 400 });
      }

      const { data: updated, error: uErr } = await client
        .from('rooms')
        .update({ admission_mode: admissionMode, updated_at: new Date().toISOString() })
        .eq('id', roomId)
        .select()
        .single();

      if (uErr) throw uErr;

      await logAdminAction({
        adminId: adminUser.id,
        adminEmail: adminUser.email || 'superadmin',
        action: 'room_update_admission_mode',
        targetEntity: 'room',
        targetId: roomId,
        details: { roomCode: room.code, previousMode: room.admission_mode, newMode: admissionMode, reason },
        ipAddress,
      });

      return NextResponse.json({ success: true, room: updated });
    }

    if (action === 'close' || action === 'reopen') {
      const isActive = action === 'reopen';
      const { data: updated, error: uErr } = await client
        .from('rooms')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', roomId)
        .select()
        .single();

      if (uErr) throw uErr;

      await logAdminAction({
        adminId: adminUser.id,
        adminEmail: adminUser.email || 'superadmin',
        action: isActive ? 'room_reopen' : 'room_close',
        targetEntity: 'room',
        targetId: roomId,
        details: { roomCode: room.code, reason },
        ipAddress,
      });

      return NextResponse.json({ success: true, room: updated });
    }

    if (action === 'remove_participant') {
      if (!participantId) {
        return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
      }

      const { error: delErr } = await client
        .from('participants')
        .delete()
        .eq('id', participantId)
        .eq('room_id', roomId);

      if (delErr) throw delErr;

      await logAdminAction({
        adminId: adminUser.id,
        adminEmail: adminUser.email || 'superadmin',
        action: 'room_remove_participant',
        targetEntity: 'participant',
        targetId: participantId,
        details: { roomId, roomCode: room.code, reason },
        ipAddress,
      });

      return NextResponse.json({ success: true, message: 'Participant removed' });
    }

    if (action === 'terminate') {
      // Closes room and cleans up active participants
      await client.from('participants').delete().eq('room_id', roomId);
      const { data: updated, error: termErr } = await client
        .from('rooms')
        .update({ is_active: false, participant_count: 0, updated_at: new Date().toISOString() })
        .eq('id', roomId)
        .select()
        .single();

      if (termErr) throw termErr;

      await logAdminAction({
        adminId: adminUser.id,
        adminEmail: adminUser.email || 'superadmin',
        action: 'room_terminate',
        targetEntity: 'room',
        targetId: roomId,
        details: { roomCode: room.code, reason: reason || 'Platform violation termination' },
        ipAddress,
      });

      return NextResponse.json({ success: true, message: 'Room terminated', room: updated });
    }

    return NextResponse.json({ error: 'Unknown room action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Room operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
