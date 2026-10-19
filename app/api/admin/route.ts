import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

// Initialize admin service client
const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function GET(request: Request) {
  try {
    // 1. Authorize caller via Bearer token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authErr,
    } = await adminClient.auth.getUser(token);

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 });
    }

    const email = user.email?.toLowerCase();
    
    // Check role in profiles
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .maybeSingle();

    const dbRole = profile?.role || user.user_metadata?.role;
    const isSuperAdmin = email === 'prakash.om.global@gmail.com' || dbRole === 'superadmin' || dbRole === 'super_admin';
    const isAdmin = email === 'admin@roomchat.com' || dbRole === 'admin';

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin or Super Admin privileges required' },
        { status: 403 }
      );
    }

    // 2. Fetch all system data
    const [usersRes, roomsRes, participantsRes, messagesRes] = await Promise.all([
      adminClient.auth.admin.listUsers({ perPage: 100 }),
      adminClient.from('rooms').select('*').order('created_at', { ascending: false }),
      adminClient.from('participants').select('*').order('joined_at', { ascending: false }),
      adminClient
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    const users = (usersRes.data?.users || []).map((u) => {
      const isUserSuperAdmin =
        u.email?.toLowerCase() === 'prakash.om.global@gmail.com' ||
        u.user_metadata?.role === 'super_admin';
      return {
        id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || u.user_metadata?.name || 'Anonymous',
        username: u.user_metadata?.username || u.email?.split('@')[0],
        age: u.user_metadata?.age || null,
        gender: u.user_metadata?.gender || null,
        role: isUserSuperAdmin ? 'super_admin' : u.user_metadata?.role || 'user',
        is_anonymous: u.is_anonymous,
        provider: u.app_metadata?.provider || 'email',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      };
    });

    const rooms = roomsRes.data || [];
    const participants = participantsRes.data || [];
    const messages = messagesRes.data || [];

    // 3. Compute Analytics
    const totalUsers = users.length;
    const totalRooms = rooms.length;
    const activeRooms = rooms.filter((r) => r.is_active).length;
    const totalMessages = messages.length;

    // Language Distribution
    const languageCounts: Record<string, number> = {};
    participants.forEach((p) => {
      const code = p.language_code || 'en';
      languageCounts[code] = (languageCounts[code] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        totalRooms,
        activeRooms,
        totalMessages,
        languageCounts,
        systemHealth: {
          database: 'healthy',
          geminiAi: 'active',
          smtp: 'connected',
        },
      },
      users,
      rooms,
      participants,
      messages,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Admin Actions (e.g. toggle room status, promote/demote user)
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
    } = await adminClient.auth.getUser(token);

    const email = user?.email?.toLowerCase();
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, status')
      .eq('id', user?.id || '')
      .maybeSingle();

    const dbRole = profile?.role || user?.user_metadata?.role;
    const isSuperAdmin = email === 'prakash.om.global@gmail.com' || dbRole === 'superadmin' || dbRole === 'super_admin';
    const isAdmin = email === 'admin@roomchat.com' || dbRole === 'admin';

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin or Super Admin privileges required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, roomId, isActive } = body;

    if (action === 'toggle_room' && roomId) {
      const { data, error } = await adminClient
        .from('rooms')
        .update({ is_active: isActive })
        .eq('id', roomId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, room: data });
    }

    if (action === 'delete_room' && roomId) {
      const { error } = await adminClient.from('rooms').delete().eq('id', roomId);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Room deleted' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Action failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
