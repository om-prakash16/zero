import { NextResponse } from 'next/server';
import { verifySuperAdmin, logAdminAction, getClientIp } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { client } = auth;

  try {
    const { data: settings, error } = await client
      .from('platform_settings')
      .select('*')
      .order('key', { ascending: true });

    if (error) throw error;

    const settingsMap: Record<string, unknown> = {};
    (settings || []).forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    return NextResponse.json({
      success: true,
      settings: settingsMap,
      raw: settings || [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query platform settings';
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
    key?: string;
    value?: unknown;
    reason?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { key, value, reason } = body;
  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value are required' }, { status: 400 });
  }

  // Validate specific platform settings
  if (key === 'default_room_capacity') {
    const val = Number(value);
    if (!Number.isInteger(val) || val < 2 || val > 16) {
      return NextResponse.json({ error: 'default_room_capacity must be an integer between 2 and 16' }, { status: 400 });
    }
  }

  if (key === 'max_permitted_capacity') {
    const val = Number(value);
    if (!Number.isInteger(val) || val < 2 || val > 32) {
      return NextResponse.json({ error: 'max_permitted_capacity must be an integer between 2 and 32' }, { status: 400 });
    }
  }

  if (key === 'default_admission_mode') {
    if (value !== 'approval_required' && value !== 'auto_approve') {
      return NextResponse.json({ error: 'default_admission_mode must be approval_required or auto_approve' }, { status: 400 });
    }
  }

  if (key === 'maintenance_mode') {
    if (typeof value !== 'boolean') {
      return NextResponse.json({ error: 'maintenance_mode must be boolean' }, { status: 400 });
    }
  }

  try {
    const { data: updated, error } = await client
      .from('platform_settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: adminUser.id,
      })
      .select()
      .single();

    if (error) throw error;

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email || 'superadmin',
      action: 'platform_setting_update',
      targetEntity: 'platform_setting',
      targetId: key,
      details: { key, value, reason },
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Setting "${key}" updated successfully`,
      setting: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update platform setting';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
