import { NextResponse } from 'next/server';
import { verifySuperAdmin, logAdminAction, getClientIp } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client } = auth;
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const statusFilter = searchParams.get('status');
  const search = (searchParams.get('search') || '').trim();

  const offset = (page - 1) * limit;

  try {
    let query = client
      .from('join_requests')
      .select('*, rooms(code, max_capacity, participant_count, is_active, admission_mode)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (search) {
      query = query.or(`display_name.ilike.%${search}%,language_name.ilike.%${search}%`);
    }

    const { data: requests, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      requests: requests || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query join requests';
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
    requestId?: string;
    action?: 'approve' | 'decline' | 'cancel';
    reason?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { requestId, action, reason } = body;
  if (!requestId || !action || !['approve', 'decline', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'Valid requestId and action (approve/decline/cancel) required' }, { status: 400 });
  }

  try {
    const { data: joinReq, error: fetchErr } = await client
      .from('join_requests')
      .select('*, rooms(*)')
      .eq('id', requestId)
      .single();

    if (fetchErr || !joinReq) {
      return NextResponse.json({ error: 'Join request not found' }, { status: 404 });
    }

    const room = joinReq.rooms;
    if (!room) {
      return NextResponse.json({ error: 'Associated room not found' }, { status: 404 });
    }

    if (action === 'approve') {
      if (room.participant_count >= room.max_capacity) {
        return NextResponse.json(
          { error: `Cannot approve request: room is at full capacity (${room.participant_count} / ${room.max_capacity})` },
          { status: 400 }
        );
      }

      // Add to participants
      const { error: partErr } = await client.from('participants').insert({
        room_id: room.id,
        user_id: joinReq.user_id,
        display_name: joinReq.display_name,
        language_code: joinReq.language_code,
        language_name: joinReq.language_name,
        is_connected: true,
      });

      if (partErr) throw partErr;

      const { data: updatedReq, error: uErr } = await client
        .from('join_requests')
        .update({
          status: 'approved',
          resolved_at: new Date().toISOString(),
          resolved_by: adminUser.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (uErr) throw uErr;

      await logAdminAction({
        adminId: adminUser.id,
        adminEmail: adminUser.email || 'superadmin',
        action: 'superadmin_approve_join_request',
        targetEntity: 'join_request',
        targetId: requestId,
        details: { roomId: room.id, roomCode: room.code, requesterName: joinReq.display_name, reason },
        ipAddress,
      });

      return NextResponse.json({ success: true, request: updatedReq });
    }

    if (action === 'decline' || action === 'cancel') {
      const targetStatus = action === 'decline' ? 'declined' : 'cancelled';
      const { data: updatedReq, error: uErr } = await client
        .from('join_requests')
        .update({
          status: targetStatus,
          resolved_at: new Date().toISOString(),
          resolved_by: adminUser.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (uErr) throw uErr;

      await logAdminAction({
        adminId: adminUser.id,
        adminEmail: adminUser.email || 'superadmin',
        action: `superadmin_${action}_join_request`,
        targetEntity: 'join_request',
        targetId: requestId,
        details: { roomId: room.id, roomCode: room.code, requesterName: joinReq.display_name, reason },
        ipAddress,
      });

      return NextResponse.json({ success: true, request: updatedReq });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Join request operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
