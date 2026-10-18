import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client } = auth;
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
  const actionFilter = searchParams.get('action');
  const search = (searchParams.get('search') || '').trim();

  const offset = (page - 1) * limit;

  try {
    let query = client
      .from('admin_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (actionFilter && actionFilter !== 'all') {
      query = query.ilike('action', `%${actionFilter}%`);
    }

    if (search) {
      query = query.or(`admin_email.ilike.%${search}%,target_entity.ilike.%${search}%,target_id.ilike.%${search}%,action.ilike.%${search}%`);
    }

    const { data: logs, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      logs: logs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query audit logs';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
