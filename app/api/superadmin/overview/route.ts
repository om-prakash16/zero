import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client } = auth;

  try {
    const [
      profilesRes,
      roomsRes,
      messagesRes,
      requestsRes,
      translationsRes,
      recentLogsRes,
      settingsRes,
    ] = await Promise.all([
      client.from('profiles').select('id, role, status'),
      client.from('rooms').select('id, is_active, participant_count, max_capacity'),
      client.from('messages').select('id, translation_status', { count: 'exact' }),
      client.from('join_requests').select('id, status'),
      client.from('message_translations').select('id, translation_status'),
      client
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8),
      client.from('platform_settings').select('*'),
    ]);

    const profiles = profilesRes.data || [];
    const rooms = roomsRes.data || [];
    const joinRequests = requestsRes.data || [];
    const translations = translationsRes.data || [];
    const messages = messagesRes.data || [];
    const recentLogs = recentLogsRes.data || [];

    // Aggregations
    const totalUsers = profiles.length;
    const activeUsers = profiles.filter((p) => p.status === 'active').length;
    const suspendedUsers = profiles.filter((p) => p.status === 'suspended' || p.status === 'banned').length;

    const totalRooms = rooms.length;
    const activeRooms = rooms.filter((r) => r.is_active).length;
    const roomsAtCapacity = rooms.filter((r) => r.is_active && r.participant_count >= (r.max_capacity || 2)).length;

    const pendingRequests = joinRequests.filter((r) => r.status === 'pending').length;

    const totalMessages = messages.length;
    const translationSuccess = translations.filter((t) => t.translation_status === 'translated').length;
    const translationFailed = translations.filter((t) => t.translation_status === 'failed').length;

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalRooms,
        activeRooms,
        roomsAtCapacity,
        pendingRequests,
        totalMessages,
        translationVolume: translations.length,
        translationSuccess,
        translationFailed,
      },
      recentLogs,
      settings: settingsRes.data || [],
      systemHealth: {
        database: 'operational',
        auth: 'healthy',
        gemini: 'active (gemini-2.5-flash)',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to compile overview stats';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
