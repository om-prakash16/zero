import { NextResponse } from 'next/server';
import { verifySuperAdmin, logAdminAction, getClientIp } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const auth = await verifySuperAdmin(request, { allowAdmin: true });
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client } = auth;
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const statusFilter = searchParams.get('status');

  const offset = (page - 1) * limit;

  try {
    let query = client
      .from('moderation_reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: reports, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      reports: reports || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query moderation reports';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Can be called by any authenticated user to report abuse
  try {
    const auth = await verifySuperAdmin(request);
    const { client } = auth.authorized ? auth : { client: (await import('@/lib/adminAuth')).getAdminSupabaseClient() };

    const body = (await request.json()) as {
      targetType: 'room' | 'user' | 'message';
      targetId: string;
      reason: string;
      reporterId?: string;
      reporterName?: string;
    };
    const { targetType, targetId, reason, reporterId, reporterName } = body;

    if (!targetType || !targetId || !reason?.trim()) {
      return NextResponse.json({ error: 'targetType, targetId, and reason are required' }, { status: 400 });
    }

    const { data: newReport, error } = await client
      .from('moderation_reports')
      .insert({
        target_type: targetType,
        target_id: targetId,
        reason: reason.trim(),
        reporter_id: reporterId || null,
        reporter_name: reporterName || 'Anonymous User',
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, report: newReport });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to submit report';
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
    reportId?: string;
    status?: 'investigating' | 'resolved' | 'dismissed';
    resolutionNotes?: string;
    actionOnTarget?: 'suspend_user' | 'terminate_room';
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { reportId, status, resolutionNotes, actionOnTarget } = body;
  if (!reportId || !status || !['investigating', 'resolved', 'dismissed'].includes(status)) {
    return NextResponse.json({ error: 'Valid reportId and status required' }, { status: 400 });
  }

  try {
    const { data: report, error: fErr } = await client
      .from('moderation_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (fErr || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Execute optional action on target
    if (actionOnTarget === 'suspend_user' && report.target_type === 'user') {
      await client.from('profiles').update({ status: 'suspended', updated_at: new Date().toISOString() }).eq('id', report.target_id);
      await logAdminAction({
        adminId: adminUser.id,
        adminEmail: adminUser.email || 'superadmin',
        action: 'user_suspend_from_report',
        targetEntity: 'user',
        targetId: report.target_id,
        details: { reportId },
        ipAddress,
      });
    } else if (actionOnTarget === 'terminate_room' && report.target_type === 'room') {
      await client.from('participants').delete().eq('room_id', report.target_id);
      await client.from('rooms').update({ is_active: false, participant_count: 0 }).eq('id', report.target_id);
      await logAdminAction({
        adminId: adminUser.id,
        adminEmail: adminUser.email || 'superadmin',
        action: 'room_terminate_from_report',
        targetEntity: 'room',
        targetId: report.target_id,
        details: { reportId },
        ipAddress,
      });
    }

    const { data: updatedReport, error: uErr } = await client
      .from('moderation_reports')
      .update({
        status,
        resolution_notes: resolutionNotes || null,
        reviewed_by: adminUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();

    if (uErr) throw uErr;

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email || 'superadmin',
      action: `moderation_report_${status}`,
      targetEntity: 'moderation_report',
      targetId: reportId,
      details: { targetType: report.target_type, targetId: report.target_id, actionOnTarget, resolutionNotes },
      ipAddress,
    });

    return NextResponse.json({ success: true, report: updatedReport });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update report';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
